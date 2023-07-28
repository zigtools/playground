const { createReadStream } = require("fs");

module.exports = function (app) {
	app.use((req, res, next) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
		res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

		if (req.url === "/zig.tar") {
			res.setHeader("Content-Type", "application/octet-stream");
			createReadStream("zig.tar").pipe(res);
			return;
		}

		next();
	});
}
