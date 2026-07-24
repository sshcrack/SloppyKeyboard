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
            description = "Charges through an eligible Sloppy Keyboard ball.";
            taskID = TaskId;
        }
        public sealed class HuntData : GooseTaskData
        {
            public float Started;
            public bool Charging;
        }
        public override GooseTaskData GetNewTaskData(GooseEntity goose)
        {
            return new HuntData { Started = Time.time };
        }
        public override void RunTask(GooseEntity goose)
        {
            var data = (HuntData)goose.currentTaskData;
            var target = Target;
            if (target == null || !ModEntryPoint.IsLive(target.Id) || Time.time - data.Started > (data.Charging ? 1.5f : 4f))
            {
                Target = null;
                API.Goose.setTaskRoaming(goose);
                return;
            }
            var fromSlotX = target.X - ModEntryPoint.SlotX;
            var fromSlotY = target.Y - ModEntryPoint.SlotY;
            var lineLength = Math.Max(1, Math.Sqrt(fromSlotX * fromSlotX + fromSlotY * fromSlotY));
            var behindX = target.X + (float)(fromSlotX / lineLength) * 80;
            var behindY = target.Y + (float)(fromSlotY / lineLength) * 80;
            var dx = behindX - goose.position.x;
            var dy = behindY - goose.position.y;
            if (!data.Charging && Math.Sqrt(dx * dx + dy * dy) < 28) data.Charging = true;
            // Stage 1 moves 80px behind the ball relative to the slot; stage 2 charges through it at the slot.
            goose.targetPos = data.Charging
                ? new Vector2(ModEntryPoint.SlotX, ModEntryPoint.SlotY)
                : new Vector2(behindX, behindY);
            goose.currentAcceleration = data.Charging ? 2400 : 900;
        }
    }
}
