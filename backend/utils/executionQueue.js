const crypto = require("crypto");

const MAX_CONCURRENT = Number(process.env.CODE_RUNNER_MAX_CONCURRENT || 2);
const MAX_QUEUE = Number(process.env.CODE_RUNNER_MAX_QUEUE || 10);

const PRIORITY = {
  EXAM_SUBMIT: 1,
  SUBMIT: 2,
  EXAM_RUN: 3,
  RUN: 4,
};

const MAX_WAIT_TIME = 10000; // 10 seconds queue limit

class QueueOverflowError extends Error {
  constructor(message = "Code execution server is busy. Please try again shortly.") {
    super(message);
    this.name = "QueueOverflowError";
    this.code = "QUEUE_OVERLOADED";
    this.statusCode = 429;
  }
}

class ExecutionQueue {
  constructor({ maxConcurrent = MAX_CONCURRENT, maxQueue = MAX_QUEUE } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
    this.running = 0;
    this.queue = [];
  }

  add(task, options = {}) {
    if (typeof task !== "function") {
      throw new TypeError("Execution queue task must be a function");
    }

    if (this.running >= this.maxConcurrent && this.queue.length >= this.maxQueue) {
      throw new QueueOverflowError();
    }

    const job = {
      id: crypto.randomUUID(),
      task,
      priority: options.priority || PRIORITY.RUN,
      label: options.label || "code-execution",
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
      this.queue.push(job);
      this.queue.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
      this.drain();
    });
  }

  drain() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      const waitMs = Date.now() - job.createdAt;

      if (waitMs > MAX_WAIT_TIME) {
        console.warn("CODE_EXEC_QUEUE_TIMEOUT", {
          jobId: job.id,
          label: job.label,
          waitMs,
        });
        const err = new Error("Execution timed out in queue");
        err.code = "QUEUE_TIMEOUT";
        err.statusCode = 429;
        job.reject(err);
        continue;
      }

      this.running += 1;

      console.log("CODE_EXEC_JOB_STARTED", {
        jobId: job.id,
        label: job.label,
        priority: job.priority,
        waitMs,
        running: this.running,
        queued: this.queue.length,
      });

      Promise.resolve()
        .then(job.task)
        .then(job.resolve)
        .catch(job.reject)
        .finally(() => {
          this.running -= 1;
          console.log("CODE_EXEC_JOB_FINISHED", {
            jobId: job.id,
            label: job.label,
            running: this.running,
            queued: this.queue.length,
          });
          this.drain();
        });
    }
  }

  getMetrics() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
    };
  }
}

module.exports = {
  executionQueue: new ExecutionQueue(),
  ExecutionQueue,
  QueueOverflowError,
  PRIORITY,
  MAX_CONCURRENT,
  MAX_QUEUE,
};
