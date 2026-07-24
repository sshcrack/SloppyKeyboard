using GooseShared;
using SamEngine;
using System;

namespace SloppyKeyboardGoose
{
    public sealed class SloppyBallHuntTask : GooseTaskInfo
    {
        public const string TaskId = "SloppyKeyboardBallHunt";
        public static BallTarget Target;
        public SloppyBallHuntTask()
        {
            canBePickedRandomly = false;
            shortName = "Sloppy Keyboard ball hunt";
            description = "Picks up an eligible ball and carries it to the mystery slot.";
            taskID = TaskId;
        }
        public sealed class HuntData : GooseTaskData
        {
            public float Started;
            public bool Carrying;
        }
        public override GooseTaskData GetNewTaskData(GooseEntity goose)
        {
            return new HuntData { Started = Time.time };
        }
        public override void RunTask(GooseEntity goose)
        {
            try { RunTaskSafe(goose); }
            catch (Exception error)
            {
                ModEntryPoint.WriteDiagnostic("Ball carry task cancelled after " + error);
                Target = null;
                if (goose != null) API.Goose.setTaskRoaming(goose);
            }
        }
        void RunTaskSafe(GooseEntity goose)
        {
            if (goose == null || goose.currentTaskData == null)
            {
                if (goose != null) API.Goose.setTaskRoaming(goose);
                return;
            }
            var data = (HuntData)goose.currentTaskData;
            var target = Target;
            if (target == null || !ModEntryPoint.IsLive(target.Id) || Time.time - data.Started > 8f)
            {
                if (data.Carrying) ModEntryPoint.ReleaseCarry(goose);
                Target = null;
                API.Goose.setTaskRoaming(goose);
                return;
            }
            if (!data.Carrying)
            {
                var dx = target.X - goose.position.x;
                var dy = target.Y - goose.position.y;
                goose.targetPos = new Vector2(target.X, target.Y);
                goose.currentAcceleration = 900;
                if (Math.Sqrt(dx * dx + dy * dy) < 30)
                {
                    data.Carrying = true;
                    ModEntryPoint.Carry(goose, target.Id);
                }
                return;
            }
            ModEntryPoint.Carry(goose, target.Id);
            goose.targetPos = new Vector2(ModEntryPoint.SlotX, ModEntryPoint.SlotY);
            goose.currentAcceleration = 1100;
            var slotDx = ModEntryPoint.SlotX - goose.position.x;
            var slotDy = ModEntryPoint.SlotY - goose.position.y;
            if (Math.Sqrt(slotDx * slotDx + slotDy * slotDy) < 36)
            {
                ModEntryPoint.ReleaseCarry(goose);
                Target = null;
                API.Goose.setTaskRoaming(goose);
            }
        }
    }
}
