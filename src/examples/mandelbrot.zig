const std = @import("std");

pub fn main(init: std.process.Init) !void {
    var buffer: [4096]u8 = undefined;
    var file_writer = std.Io.File.stdout().writerStreaming(init.io, &buffer);
    const stdout = &file_writer.interface;

    const width = 64;
    const height = 24;
    const iterations = 60;
    const shades = " .:-=+*#%@";
    const real_min = -2.2;
    const real_max = 1.0;
    const imag_min = -1.2;
    const imag_max = 1.2;
    const real_ratio = (real_max - real_min) / @as(f64, @floatFromInt(width - 1));
    const imag_ratio = (imag_max - imag_min) / @as(f64, @floatFromInt(height - 1));

    for (0..height) |y| {
        const imag = imag_min + @as(f64, @floatFromInt(y)) * imag_ratio;

        for (0..width) |x| {
            const real = real_min + @as(f64, @floatFromInt(x)) * real_ratio;

            var zx: f64 = 0;
            var zy: f64 = 0;
            var i: usize = 0;

            while (zx * zx + zy * zy <= 4 and i < iterations) : (i += 1) {
                const next_zx = zx * zx - zy * zy + real;
                zy = 2 * zx * zy + imag;
                zx = next_zx;
            }

            const shade = i * (shades.len - 1) / iterations;
            try stdout.writeByte(shades[shade]);
        }

        try stdout.writeByte('\n');
    }

    try stdout.flush();
}
