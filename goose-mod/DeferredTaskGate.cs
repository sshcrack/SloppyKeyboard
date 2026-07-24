namespace SloppyKeyboardGoose
{
    // Desktop Goose v0.31 exposes taskIndexQueue but leaves it null. This gate
    // defers a requested custom task without depending on that unusable field.
    public sealed class DeferredTaskGate
    {
        readonly long graceMilliseconds;
        int requestedTask = -1;
        int observedTask = -1;
        long requestedAt;

        public DeferredTaskGate(long graceMilliseconds)
        {
            this.graceMilliseconds = graceMilliseconds;
        }

        public bool HasRequest { get { return requestedTask >= 0; } }
        public int RequestedTask { get { return requestedTask; } }

        public void Request(int task, int currentTask, long now)
        {
            if (task < 0 || requestedTask == task) return;
            requestedTask = task;
            observedTask = currentTask;
            requestedAt = now;
        }

        public bool ShouldStart(int currentTask, long now, bool pulledWindowOpen)
        {
            if (!HasRequest) return false;
            return currentTask != observedTask
                || (!pulledWindowOpen && now - requestedAt >= graceMilliseconds);
        }

        public int Consume()
        {
            var task = requestedTask;
            requestedTask = -1;
            observedTask = -1;
            requestedAt = 0;
            return task;
        }

        public void Cancel()
        {
            requestedTask = -1;
            observedTask = -1;
            requestedAt = 0;
        }
    }
}
