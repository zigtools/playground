const std = @import("std");

pub fn main(init: std.process.Init) !void {
    var buffer: [4096]u8 = undefined;
    var file_writer = std.Io.File.stdout().writerStreaming(init.io, &buffer);
    const stdout = &file_writer.interface;

    var a: u32 = 0;
    var b: u32 = 1;

    for (0..12) |_| {
        try stdout.print("{d}\n", .{a});
        const c = a + b;
        a = b;
        b = c;
    }

    try stdout.flush();
}
