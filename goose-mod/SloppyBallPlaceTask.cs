using GooseShared;
using SamEngine;
using System;

namespace SloppyKeyboardGoose
{
    public sealed class SloppyBallPlaceTask : GooseTaskInfo
    {
        public const string TaskId = "SloppyKeyboardPlaceBall";

        public SloppyBallPlaceTask()
        {
            canBePickedRandomly = false;
            shortName = "Sloppy Keyboard ball delivery";
            description = "Walks to the drop rail and places a ball near the mystery slot.";
            taskID = TaskId;
        }

        public sealed class PlaceData : GooseTaskData
        {
            public float Started;
            public float AnimationStarted;
            public bool Animating;
            public bool Placed;
        }

        public override GooseTaskData GetNewTaskData(GooseEntity goose)
        {
            ModEntryPoint.WriteDiagnostic("Ball placement task initialized.");
            return new PlaceData { Started = Time.time };
        }

        public override void RunTask(GooseEntity goose)
        {
            try { RunTaskSafe(goose); }
            catch (Exception error)
            {
                ModEntryPoint.WriteDiagnostic("Ball placement task cancelled after " + error);
                ModEntryPoint.CancelPlacement();
                if (goose != null) API.Goose.setTaskRoaming(goose);
            }
        }

        void RunTaskSafe(GooseEntity goose)
        {
            if (goose == null || goose.currentTaskData == null)
            {
                ModEntryPoint.CancelPlacement();
                if (goose != null) API.Goose.setTaskRoaming(goose);
                return;
            }
            var data = (PlaceData)goose.currentTaskData;
            if (Time.time - data.Started > 25f)
            {
                goose.extendingNeck = false;
                ModEntryPoint.CancelPlacement();
                API.Goose.setTaskRoaming(goose);
                return;
            }

            goose.targetPos = new Vector2(ModEntryPoint.PlacementX, ModEntryPoint.PlacementY);
            goose.currentAcceleration = 700;
            var dx = ModEntryPoint.PlacementX - goose.position.x;
            var dy = ModEntryPoint.PlacementY - goose.position.y;
            if (!data.Animating && Math.Sqrt(dx * dx + dy * dy) < 32)
            {
                data.Animating = true;
                data.AnimationStarted = Time.time;
                goose.extendingNeck = true;
                API.Goose.playHonckSound();
            }
            if (!data.Animating) return;

            // Hold at the rail and extend the neck before releasing the ball.
            goose.currentAcceleration = 0;
            if (!data.Placed && Time.time - data.AnimationStarted >= 0.65f)
            {
                data.Placed = true;
                ModEntryPoint.EmitPlacedBall();
            }
            if (data.Placed && Time.time - data.AnimationStarted >= 1.05f)
            {
                goose.extendingNeck = false;
                API.Goose.setTaskRoaming(goose);
            }
        }
    }
}
