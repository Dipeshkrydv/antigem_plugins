// DeepX Google Flow Studio — AntiGem plugin worker. All logic lives in deepx-core.js.
import { configureDeepX, deepxExecute, mcpListener } from './deepx-core.js';
configureDeepX({ pluginId: 'deepx-google-flow', version: '1.2.1' });
chrome.runtime.onMessage.addListener(mcpListener(deepxExecute));
