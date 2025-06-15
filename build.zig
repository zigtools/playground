const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{ .cpu_arch = .wasm32, .os_tag = .wasi });
    const optimize: std.builtin.OptimizeMode = .ReleaseFast;

    const zls = b.dependency("zls", .{
        .target = target,
        .optimize = optimize,
        .@"version-string" = @as([]const u8, "0.14.0-dev"),
    }).module("zls");

    const exe = b.addExecutable(.{
        .name = "zls-playground",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "zls", .module = zls },
            },
        }),
    });
    exe.entry = .disabled;
    exe.rdynamic = true;
    b.installArtifact(exe);
}
