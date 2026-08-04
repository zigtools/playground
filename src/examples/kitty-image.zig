const std = @import("std");

fn color(x: f64, y: f64) [3]f64 {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const radius = 0.3;
    const center_dist = @sqrt(dx * dx + dy * dy) - radius;
    if (center_dist < 0) {
        return .{ 1.0, 1.0, 1.0 };
    } else {
        return .{ x, y, 1.0 - x };
    }
}

pub fn main(init: std.process.Init) !void {
    var buffer: [4096]u8 = undefined;
    var file_writer = std.Io.File.stdout().writerStreaming(init.io, &buffer);
    const stdout = &file_writer.interface;

    const width = 400;
    const height = 400;
    // https://sw.kovidgoyal.net/kitty/graphics-protocol/#remote-client
    // from Kitty docs "The pixel data must first be base64 encoded then chunked up into chunks no larger than 4096 bytes."
    // 1024 RGB pixels -> 3072 bytes -> 3072 / 3 * 4 = 4096 Base64 bytes
    const pixels_per_chunk = 1024;
    var pixels: [pixels_per_chunk * 3]u8 = undefined;
    var encoded: [4096]u8 = undefined;

    var pixel: usize = 0;
    while (pixel < width * height) {
        const chunk_end = @min(pixel + pixels_per_chunk, width * height);
        const more: usize = @intFromBool(chunk_end < width * height);

        if (pixel == 0) {
            try stdout.print("\x1b_Ga=T,f=24,s={d},v={d},m={d};", .{ width, height, more });
        } else {
            try stdout.print("\x1b_Gm={d};", .{more});
        }

        var count: usize = 0;
        while (pixel < chunk_end) : (pixel += 1) {
            const x = @as(f64, @floatFromInt(pixel % width)) / (width - 1);
            const y = @as(f64, @floatFromInt(pixel / width)) / (height - 1);
            const rgb = color(x, y);
            pixels[count] = @intFromFloat(rgb[0] * 255);
            pixels[count + 1] = @intFromFloat(rgb[1] * 255);
            pixels[count + 2] = @intFromFloat(rgb[2] * 255);
            count += 3;
        }

        const Encoder = std.base64.standard.Encoder;
        try stdout.writeAll(Encoder.encode(&encoded, pixels[0..count]));
        try stdout.writeAll("\x1b\\");
    }

    try stdout.flush();
}
