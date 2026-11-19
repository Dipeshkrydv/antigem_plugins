"""
Scheduler module alias for backward compatibility.
Exports SchedulerEngine as FacebookScheduler and the global scheduler instance.
"""

from .scheduler_engine import SchedulerEngine, scheduler, SchedulerEngine as FacebookScheduler

__all__ = ["SchedulerEngine", "FacebookScheduler", "scheduler"]
