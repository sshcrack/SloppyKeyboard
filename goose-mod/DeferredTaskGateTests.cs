using System;
using SloppyKeyboardGoose;

public static class DeferredTaskGateTests
{
    static void Assert(bool value, string message)
    {
        if (!value) throw new Exception(message);
    }

    public static int Main()
    {
        var gate = new DeferredTaskGate(1500);
        gate.Request(9, 4, 1000);
        Assert(!gate.ShouldStart(4, 2000, false), "must honor grace period");
        Assert(!gate.ShouldStart(4, 3000, true), "must not interrupt a pulled window");
        Assert(gate.ShouldStart(4, 3000, false), "must start after grace without a window");
        Assert(gate.Consume() == 9, "must return the requested task");

        gate.Request(8, 4, 4000);
        Assert(gate.ShouldStart(5, 4100, true), "natural task completion must release gate");
        Console.WriteLine("DeferredTaskGate regression tests passed.");
        return 0;
    }
}
