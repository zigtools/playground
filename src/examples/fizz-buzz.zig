const std = @import("std");

pub fn main(init: std.process.Init) !void {
    var buffer: [4096]u8 = undefined;
    var file_writer = std.Io.File.stdout().writerStreaming(init.io, &buffer);
    const stdout = &file_writer.interface;

    for (1..21) |number| {
        if (number % 15 == 0) {
            try stdout.writeAll("FizzBuzz\n");
        } else if (number % 3 == 0) {
            try stdout.writeAll("Fizz\n");
        } else if (number % 5 == 0) {
            try stdout.writeAll("Buzz\n");
        } else {
            try stdout.print("{d}\n", .{number});
        }
    }

    try stdout.flush();
}
