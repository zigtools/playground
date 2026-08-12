const std = @import("std");

pub fn main(init: std.process.Init) !void {
    var buffer: [4096]u8 = undefined;
    var file_writer = std.Io.File.stdout().writerStreaming(init.io, &buffer);
    const stdout = &file_writer.interface;

    try stdout.writeAll("\x1b[31mred\n");
    try stdout.writeAll("\x1b[32mgreen\n");
    try stdout.writeAll("\x1b[33myellow\n");
    try stdout.writeAll("\x1b[34mblue\n");
    try stdout.writeAll("\x1b[35mmagenta\n");
    try stdout.writeAll("\x1b[36mcyan\n");
    try stdout.writeAll("\x1b[37mwhite\n");
    try stdout.writeAll("\x1b[0mreset\n");
    try stdout.flush();
}
