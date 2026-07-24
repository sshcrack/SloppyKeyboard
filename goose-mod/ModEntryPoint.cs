using GooseShared;
using SamEngine;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace SloppyKeyboardGoose
{
    public sealed class ModEntryPoint : IMod
    {
        const string PipeName = "sloppy-keyboard-goose-v1";
        const string DiagnosticsFileName = "sloppy-keyboard-goose.log";
        static readonly object Sync = new object();
        static readonly Dictionary<string, BallTarget> Balls = new Dictionary<string, BallTarget>();
        static readonly HashSet<string> ClaimedBalls = new HashSet<string>();
        static readonly Dictionary<long, WindowSample> Windows = new Dictionary<long, WindowSample>();
        static Thread pipeThread;
        static NamedPipeClientStream pipe;
        static StreamWriter writer;
        static readonly DeferredTaskGate TaskGate = new DeferredTaskGate(1500);
        static bool taskIdsLogged;
        static long lastSnapshot;
        internal static float SlotX;
        internal static float SlotY;
        static float slotWidth;
        static readonly Random Random = new Random();
        static long nextSpawnAt;
        static string pendingSpawnId;
        static float pendingSpawnX;
        static bool placementRequested;
        internal static float PlacementX;
        internal static float PlacementY;
        static string carriedBallId;
        static string releasedBallId;
        static float carryX;
        static float carryY;
        static float carryVelocityX;
        static float carryVelocityY;
        static volatile bool suspended;
        static bool suspensionHandled;

        void IMod.Init()
        {
            WriteDiagnostic("IMod.Init invoked; Sloppy Keyboard Goose mod loaded.");
            nextSpawnAt = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond + 7000;
            pipeThread = new Thread(PipeLoop) { IsBackground = true, Name = "Sloppy Keyboard pipe" };
            pipeThread.Start();
            InjectionPoints.PostTickEvent += PostTick;
        }

        // This is deliberately independent of the named-pipe integration: it
        // proves that Desktop Goose discovered and initialized this DLL.
        internal static void WriteDiagnostic(string message)
        {
            try
            {
                File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, DiagnosticsFileName),
                    DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture) + " " + message + Environment.NewLine);
            }
            catch { }
        }

        static void PipeLoop()
        {
            while (true)
            {
                try
                {
                    using (var client = new NamedPipeClientStream(".", PipeName, PipeDirection.InOut))
                    {
                        client.Connect(1000);
                        pipe = client;
                        writer = new StreamWriter(client, new UTF8Encoding(false)) { AutoFlush = true };
                        using (var reader = new StreamReader(client, Encoding.UTF8))
                        {
                            string line;
                            while ((line = reader.ReadLine()) != null) ReadBalls(line);
                        }
                    }
                }
                catch { Thread.Sleep(500); }
                finally { pipe = null; writer = null; }
            }
        }

        static void ReadBalls(string json)
        {
            if (json.Contains("\"type\":\"power\"") && json.Contains("\"protocolVersion\":1"))
            {
                suspended = json.Contains("\"suspended\":true");
                return;
            }
            if (!json.Contains("\"type\":\"balls\"") || !json.Contains("\"protocolVersion\":1")) return;
            var found = new Dictionary<string, BallTarget>();
            var slot = Regex.Match(json, "\"mysterySlot\":\\{\"x\":(?<x>-?[0-9.]+),\"y\":(?<y>-?[0-9.]+),\"width\":(?<w>[0-9.]+),\"height\":(?<h>[0-9.]+)");
            var board = Regex.Match(json, "\"boardBounds\":\\{\"x\":(?<x>-?[0-9.]+),\"y\":(?<y>-?[0-9.]+),\"width\":(?<w>[0-9.]+),\"height\":(?<h>[0-9.]+)");
            float sx, sy, sw, sh;
            if (slot.Success
                && float.TryParse(slot.Groups["x"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sx)
                && float.TryParse(slot.Groups["y"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sy)
                && float.TryParse(slot.Groups["w"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sw)
                && float.TryParse(slot.Groups["h"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sh))
            { SlotX = sx + sw / 2; SlotY = sy + sh / 2; slotWidth = sw; }
            float boardY;
            if (board.Success
                && float.TryParse(board.Groups["y"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out boardY))
                PlacementY = boardY + 26;
            foreach (Match match in Regex.Matches(json,
                "\\{\"id\":\"(?<id>[^\"]+)\",\"x\":(?<x>-?[0-9.]+),\"y\":(?<y>-?[0-9.]+).*?\"huntEligible\":(?<hunt>true|false)"))
            {
                if (match.Groups["hunt"].Value != "true") continue;
                float x, y;
                if (float.TryParse(match.Groups["x"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out x)
                    && float.TryParse(match.Groups["y"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out y))
                    found[match.Groups["id"].Value] = new BallTarget(match.Groups["id"].Value, x, y);
            }
            lock (Sync)
            {
                Balls.Clear();
                foreach (var item in found) Balls[item.Key] = item.Value;
                ClaimedBalls.RemoveWhere(id => !found.ContainsKey(id));
            }
        }

        static void PostTick(GooseEntity goose)
        {
            try { PostTickSafe(goose); }
            catch (Exception error)
            {
                WriteDiagnostic("PostTick skipped after " + error);
            }
        }

        static void PostTickSafe(GooseEntity goose)
        {
            if (goose == null) return;
            var now = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
            if (suspended)
            {
                if (!suspensionHandled)
                {
                    suspensionHandled = true;
                    TaskGate.Cancel();
                    placementRequested = false;
                    if (carriedBallId != null) ReleaseCarry(goose);
                    var suspendedHuntTask = API.TaskDatabase.getTaskIndexByID(SloppyBallHuntTask.TaskId);
                    var suspendedPlacementTask = API.TaskDatabase.getTaskIndexByID(SloppyBallPlaceTask.TaskId);
                    if (goose.currentTask == suspendedHuntTask
                        || goose.currentTask == suspendedPlacementTask)
                        API.Goose.setTaskRoaming(goose);
                    WriteDiagnostic("Custom behavior suspended for system sleep.");
                }
                return;
            }
            if (suspensionHandled)
            {
                suspensionHandled = false;
                nextSpawnAt = now + 10000;
                lastSnapshot = now;
                WriteDiagnostic("Custom behavior resumed after system sleep.");
            }
            if (SlotX != 0 && PlacementY != 0 && now >= nextSpawnAt
                && !placementRequested && pendingSpawnId == null)
            {
                placementRequested = true;
                PlacementX = SlotX + (float)(Random.NextDouble() - 0.5) * slotWidth * 0.24f;
            }
            if (now - lastSnapshot >= 33)
            {
                lastSnapshot = now;
                SendSnapshot(goose);
            }
            BallTarget nearest = null;
            lock (Sync)
            {
                if (Balls.Count > 0)
                    nearest = Balls.Values.Where(ball => !ClaimedBalls.Contains(ball.Id))
                        .OrderBy(ball => DistanceSquared(goose.position.x, goose.position.y, ball.X, ball.Y)).FirstOrDefault();
            }
            var huntTask = API.TaskDatabase.getTaskIndexByID(SloppyBallHuntTask.TaskId);
            var placementTask = API.TaskDatabase.getTaskIndexByID(SloppyBallPlaceTask.TaskId);
            if (!taskIdsLogged)
            {
                taskIdsLogged = true;
                WriteDiagnostic(String.Format(CultureInfo.InvariantCulture,
                    "Custom task IDs resolved: hunt={0}, placement={1}.", huntTask, placementTask));
            }
            if (goose.currentTask == placementTask)
            {
                TaskGate.Cancel();
                return;
            }
            if (goose.currentTask == huntTask)
            {
                TaskGate.Cancel();
                var activeTarget = SloppyBallHuntTask.Target;
                if (activeTarget != null && IsLive(activeTarget.Id))
                    lock (Sync) ClaimedBalls.Add(activeTarget.Id);
                return;
            }

            var desiredTask = -1;
            if (placementRequested && placementTask >= 0)
                desiredTask = placementTask;
            else if (nearest != null && huntTask >= 0)
            {
                desiredTask = huntTask;
                // Keep the target fresh while Goose finishes its current task.
                SloppyBallHuntTask.Target = nearest;
            }

            if (desiredTask < 0)
            {
                TaskGate.Cancel();
                return;
            }
            TaskGate.Request(desiredTask, goose.currentTask, now);
            if (TaskGate.ShouldStart(goose.currentTask, now, HasOpenGooseWindow(now)))
            {
                var task = TaskGate.Consume();
                var taskId = task == placementTask
                    ? SloppyBallPlaceTask.TaskId
                    : SloppyBallHuntTask.TaskId;
                WriteDiagnostic("Starting deferred custom task: " + taskId + ".");
                API.Goose.setCurrentTaskByID(goose, taskId, false);
            }
        }

        internal static bool IsLive(string id)
        {
            lock (Sync) return Balls.ContainsKey(id);
        }

        internal static void Carry(GooseEntity goose, string ballId)
        {
            carriedBallId = ballId;
            carryX = goose.position.x + (float)Math.Cos(goose.direction) * 28;
            carryY = goose.position.y + (float)Math.Sin(goose.direction) * 28;
            carryVelocityX = goose.velocity.x;
            carryVelocityY = goose.velocity.y;
        }

        internal static void ReleaseCarry(GooseEntity goose)
        {
            releasedBallId = carriedBallId;
            carriedBallId = null;
            carryVelocityX = goose.velocity.x;
            carryVelocityY = goose.velocity.y;
        }

        internal static void EmitPlacedBall()
        {
            var now = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
            pendingSpawnId = now.ToString(CultureInfo.InvariantCulture);
            pendingSpawnX = PlacementX;
            placementRequested = false;
            nextSpawnAt = now + Random.Next(7000, 14001);
            WriteDiagnostic("Goose emitted placed ball " + pendingSpawnId + ".");
        }

        internal static void CancelPlacement()
        {
            placementRequested = false;
            TaskGate.Cancel();
            nextSpawnAt = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond
                + Random.Next(7000, 14001);
        }

        static bool HasOpenGooseWindow(long now)
        {
            return Windows.Values.Any(sample => now - sample.At <= 150);
        }

        static float DistanceSquared(float ax, float ay, float bx, float by)
        {
            var x = ax - bx; var y = ay - by; return x * x + y * y;
        }

        static void SendSnapshot(GooseEntity goose)
        {
            var now = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
            var output = writer;
            if (output == null || pipe == null || !pipe.IsConnected) return;
            var colliders = new List<string>();
            // v0.31 draws the body around position and the head ahead of its facing direction.
            colliders.Add(Circle("body", goose.position.x, goose.position.y, 22, goose.velocity.x, goose.velocity.y));
            colliders.Add(Circle("head", goose.position.x + (float)Math.Cos(goose.direction) * 24,
                goose.position.y + (float)Math.Sin(goose.direction) * 24, 14, goose.velocity.x, goose.velocity.y));
            var forms = SnapshotOpenForms();
            foreach (var form in forms)
            {
                try
                {
                    if (form == null || !form.Visible || form.IsDisposed || !IsGooseWindow(form)) continue;
                    var bounds = form.Bounds;
                    var handle = form.Handle.ToInt64();
                    WindowSample previous;
                    var vx = 0f; var vy = 0f;
                    if (Windows.TryGetValue(handle, out previous))
                    {
                        var frames = Math.Max(1, (now - previous.At) / 16.6667);
                        vx = (float)((bounds.X - previous.X) / frames);
                        vy = (float)((bounds.Y - previous.Y) / frames);
                    }
                    Windows[handle] = new WindowSample(bounds.X, bounds.Y, now);
                    colliders.Add(String.Format(CultureInfo.InvariantCulture,
                        "{{\"id\":\"window-{0}\",\"kind\":\"window\",\"bounds\":{{\"x\":{1},\"y\":{2},\"width\":{3},\"height\":{4}}},\"velocityX\":{5},\"velocityY\":{6}}}",
                        handle, bounds.X, bounds.Y, bounds.Width, bounds.Height, vx, vy));
                }
                catch (Exception error) { WriteDiagnostic("Window snapshot skipped after " + error); }
            }
            foreach (var closed in Windows.Where(item => now - item.Value.At > 100).Select(item => item.Key).ToArray())
                Windows.Remove(closed);
            var carries = new List<string>();
            if (carriedBallId != null) carries.Add(CarryJson(carriedBallId, false));
            if (releasedBallId != null) carries.Add(CarryJson(releasedBallId, true));
            var spawns = new List<string>();
            if (pendingSpawnId != null)
                spawns.Add(String.Format(CultureInfo.InvariantCulture,
                    "{{\"id\":\"{0}\",\"x\":{1}}}", pendingSpawnId, pendingSpawnX));
            try
            {
                output.WriteLine("{\"protocolVersion\":1,\"colliders\":[" + String.Join(",", colliders)
                    + "],\"carries\":[" + String.Join(",", carries)
                    + "],\"spawnRequests\":[" + String.Join(",", spawns) + "]}");
                releasedBallId = null;
                pendingSpawnId = null;
            }
            catch { }
        }

        static bool IsGooseWindow(Form form)
        {
            var name = (form.GetType().Name + " " + form.Name + " " + form.Text).ToLowerInvariant();
            return name.Contains("meme") || name.Contains("notepad") || name.Contains("donat");
        }

        static Form[] SnapshotOpenForms()
        {
            var forms = new List<Form>();
            try
            {
                var count = Application.OpenForms.Count;
                for (var index = 0; index < count; index++)
                {
                    try
                    {
                        var form = Application.OpenForms[index];
                        if (form != null) forms.Add(form);
                    }
                    catch (ArgumentOutOfRangeException) { break; }
                }
            }
            catch (Exception error) { WriteDiagnostic("OpenForms snapshot skipped after " + error); }
            return forms.ToArray();
        }

        static string Circle(string id, float x, float y, float radius, float vx, float vy)
        {
            return String.Format(CultureInfo.InvariantCulture,
                "{{\"id\":\"{0}\",\"kind\":\"circle\",\"x\":{1},\"y\":{2},\"radius\":{3},\"velocityX\":{4},\"velocityY\":{5}}}",
                id, x, y, radius, vx, vy);
        }

        static string CarryJson(string ballId, bool released)
        {
            return String.Format(CultureInfo.InvariantCulture,
                "{{\"ballId\":\"{0}\",\"x\":{1},\"y\":{2},\"velocityX\":{3},\"velocityY\":{4},\"released\":{5}}}",
                ballId, carryX, carryY, carryVelocityX, carryVelocityY,
                released ? "true" : "false");
        }
    }

    public sealed class BallTarget
    {
        public readonly string Id; public readonly float X; public readonly float Y;
        public BallTarget(string id, float x, float y) { Id = id; X = x; Y = y; }
    }
    sealed class WindowSample
    {
        public readonly int X; public readonly int Y; public readonly long At;
        public WindowSample(int x, int y, long at) { X = x; Y = y; At = at; }
    }
}
