"""
WebSocket Bridge Server for Facebook Automation
Provides bidirectional, origin-checked WebSocket transport on ws://127.0.0.1:8766
between the MCP Server and the Chrome/Kiwi Browser Extension.
"""

import asyncio
import json
import logging
import uuid
import time
from typing import Dict, Any, Optional
import websockets
from .config import WS_HOST, WS_PORT, ALLOWED_ORIGIN_PREFIXES

logger = logging.getLogger("FacebookBridgeServer")

class FacebookBridgeServer:
    def __init__(self, host: str = WS_HOST, port: int = WS_PORT):
        self.host = host
        self.port = port
        self.active_client: Optional[websockets.WebSocketServerProtocol] = None
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.server = None
        self.last_ping = 0.0
        self.client_info: Dict[str, Any] = {}

    def is_connected(self) -> bool:
        return self.active_client is not None and not self.active_client.closed

    async def start(self):
        """Starts WebSocket server."""
        self.server = await websockets.serve(
            self._handle_connection,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=20
        )
        logger.info("Facebook WebSocket Bridge running on ws://%s:%d", self.host, self.port)

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("Facebook WebSocket Bridge stopped.")

    async def _handle_connection(self, websocket, path):
        # Security origin check
        origin = websocket.request_headers.get("Origin", "")
        if origin and not any(origin.startswith(p) for p in ALLOWED_ORIGIN_PREFIXES):
            logger.warning("Rejected unauthorized WebSocket origin: %s", origin)
            await websocket.close(code=4003, reason="Unauthorized origin")
            return

        logger.info("Chrome Extension client connected: %s (Origin: %s)", websocket.remote_address, origin)
        self.active_client = websocket

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                except Exception as e:
                    logger.error("Failed to parse incoming WS message: %s", e)
                    continue

                msg_type = data.get("type", "")
                req_id = data.get("request_id")

                # Handle pong / status
                if msg_type == "PONG" or msg_type == "STATUS":
                    self.last_ping = time.time()
                    if "client_info" in data:
                        self.client_info = data["client_info"]
                    continue

                # Match pending request
                if req_id and req_id in self.pending_requests:
                    future = self.pending_requests.pop(req_id)
                    if not future.done():
                        future.set_result(data)
                elif msg_type == "HEARTBEAT":
                    await websocket.send(json.dumps({"type": "HEARTBEAT_ACK", "timestamp": time.time()}))
                else:
                    logger.debug("Received unhandled message: %s", msg_type)

        except websockets.exceptions.ConnectionClosed:
            logger.info("Extension client disconnected.")
        finally:
            if self.active_client == websocket:
                self.active_client = None

    async def send_command(self, action: str, payload: Dict[str, Any], timeout: float = 60.0) -> Dict[str, Any]:
        """Dispatches an action to the connected extension and awaits verified response."""
        if not self.is_connected():
            return {
                "success": False,
                "error": "Extension not connected. Ensure the Antigravity Facebook Bridge extension is enabled in Chrome or Kiwi Browser on Android."
            }

        req_id = str(uuid.uuid4())
        msg = {
            "type": "MCP_COMMAND",
            "request_id": req_id,
            "action": action,
            "payload": payload,
            "timestamp": time.time()
        }

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self.pending_requests[req_id] = future

        try:
            await self.active_client.send(json.dumps(msg))
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
        except asyncio.TimeoutError:
            self.pending_requests.pop(req_id, None)
            return {
                "success": False,
                "error": f"Bridge command '{action}' timed out after {timeout}s waiting for browser extension response."
            }
        except Exception as e:
            self.pending_requests.pop(req_id, None)
            return {"success": False, "error": str(e)}
