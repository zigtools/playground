// Ported from https://www.shadertoy.com/view/MdlXz8

const std = @import("std");
const pow = std.math.pow;
const clamp = std.math.clamp;
const tau = std.math.tau;

fn color(x: f64, y: f64) [3]f64 {
    const time = 23.0;
    const p = [2]f64{
        @mod(x * tau, tau) - 250.0,
        @mod(y * tau, tau) - 250.0,
    };
    var i = p;
    var c: f64 = 1.0;
    const inten = 0.005;

    for (0..5) |n| {
        const t = time * (1.0 - 3.5 / @as(f64, @floatFromInt(n + 1)));
        const prev = i;
        i = .{
            p[0] + @cos(t - prev[0]) + @sin(t + prev[1]),
            p[1] + @sin(t - prev[1]) + @cos(t + prev[0]),
        };

        const dx = p[0] / (@sin(i[0] + t) / inten);
        const dy = p[1] / (@cos(i[1] + t) / inten);
        c += 1.0 / @sqrt(dx * dx + dy * dy);
    }

    c /= 5.0;
    c = 1.17 - pow(f64, c, 1.4);
    const colour = pow(f64, @abs(c), 8.0);

    return .{
        clamp(colour, 0.0, 1.0),
        clamp(colour + 0.35, 0.0, 1.0),
        clamp(colour + 0.5, 0.0, 1.0),
    };
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
    // TODO use std.base64 after compiler update
    const base64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    var pixel: usize = 0;
    while (pixel < width * height) {
        const chunk_end = @min(pixel + pixels_per_chunk, width * height);
        const more: usize = @intFromBool(chunk_end < width * height);

        if (pixel == 0) {
            try stdout.print("\x1b_Ga=T,f=24,s={d},v={d},m={d};", .{ width, height, more });
        } else {
            try stdout.print("\x1b_Gm={d};", .{more});
        }

        while (pixel < chunk_end) : (pixel += 1) {
            const x = @as(f64, @floatFromInt(pixel % width)) / (width - 1);
            const y = @as(f64, @floatFromInt(pixel / width)) / (height - 1);
            const rgb = color(x, y);
            const red: u8 = @intFromFloat(rgb[0] * 255);
            const green: u8 = @intFromFloat(rgb[1] * 255);
            const blue: u8 = @intFromFloat(rgb[2] * 255);

            try stdout.writeByte(base64[red >> 2]);
            try stdout.writeByte(base64[((red & 0x03) << 4) | (green >> 4)]);
            try stdout.writeByte(base64[((green & 0x0f) << 2) | (blue >> 6)]);
            try stdout.writeByte(base64[blue & 0x3f]);
        }

        try stdout.writeAll("\x1b\\");
    }

    try stdout.flush();
}
