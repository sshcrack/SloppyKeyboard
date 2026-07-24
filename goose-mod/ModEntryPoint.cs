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
        static int pendingTask = -1;
        static long lastSnapshot;
        internal static float SlotX;
        internal static float SlotY;
        static string carriedBallId;
        static string releasedBallId;
        static float carryX;
        static float carryY;
        static float carryVelocityX;
        static float carryVelocityY;

        void IMod.Init()
        {
            WriteDiagnostic("IMod.Init invoked; Sloppy Keyboard Goose mod loaded.");
            pipeThread = new Thread(PipeLoop) { IsBackground = true, Name = "Sloppy Keyboard pipe" };
            pipeThread.Start();
            InjectionPoints.PostTickEvent += PostTick;
        }

        // This is deliberately independent of the named-pipe integration: it
        // proves that Desktop Goose discovered and initialized this DLL.
        static void WriteDiagnostic(string message)
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
            if (!json.Contains("\"type\":\"balls\"") || !json.Contains("\"protocolVersion\":1")) return;
            var found = new Dictionary<string, BallTarget>();
            var slot = Regex.Match(json, "\"mysterySlot\":\\{\"x\":(?<x>-?[0-9.]+),\"y\":(?<y>-?[0-9.]+),\"width\":(?<w>[0-9.]+),\"height\":(?<h>[0-9.]+)");
            float sx, sy, sw, sh;
            if (slot.Success
                && float.TryParse(slot.Groups["x"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sx)
                && float.TryParse(slot.Groups["y"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sy)
                && float.TryParse(slot.Groups["w"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sw)
                && float.TryParse(slot.Groups["h"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out sh))
            { SlotX = sx + sw / 2; SlotY = sy + sh / 2; }
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
            var now = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
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
            if (nearest == null) return;
            if (pendingTask < 0) pendingTask = goose.currentTask;
            // Wait until the built-in activity (including pulling a window) naturally changes task.
            if (goose.currentTask == pendingTask) return;
            SloppyBallHuntTask.Target = nearest;
            lock (Sync) ClaimedBalls.Add(nearest.Id);
            API.Goose.setCurrentTaskByID(goose, SloppyBallHuntTask.TaskId, false);
            pendingTask = -1;
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
            foreach (Form form in Application.OpenForms)
            {
                if (!form.Visible || form.IsDisposed || !IsGooseWindow(form)) continue;
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
            foreach (var closed in Windows.Where(item => now - item.Value.At > 100).Select(item => item.Key).ToArray())
                Windows.Remove(closed);
            var carries = new List<string>();
            if (carriedBallId != null) carries.Add(CarryJson(carriedBallId, false));
            if (releasedBallId != null) carries.Add(CarryJson(releasedBallId, true));
            try
            {
                output.WriteLine("{\"protocolVersion\":1,\"colliders\":[" + String.Join(",", colliders)
                    + "],\"carries\":[" + String.Join(",", carries) + "]}");
                releasedBallId = null;
            }
            catch { }
        }

        static bool IsGooseWindow(Form form)
        {
            var name = (form.GetType().Name + " " + form.Name + " " + form.Text).ToLowerInvariant();
            return name.Contains("meme") || name.Contains("notepad") || name.Contains("donat");
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
