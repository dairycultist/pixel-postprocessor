const { Jimp, ResizeStrategy } = require("jimp"); // npm install jimp
const { intToRGBA } = require("@jimp/utils");

function get_rgb1(image, x, y) {

	let rgb = intToRGBA(image.getPixelColor(x, y));

	return [rgb.r / 255.0, rgb.g / 255.0, rgb.b / 255.0];
}

function color_difference(c1, c2) {

	return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2) + Math.pow(c1[2] - c2[2], 2));
}

function rgb1_to_hex(r, g, b) {

	r = Math.floor(r * 255);
	g = Math.floor(g * 255);
	b = Math.floor(b * 255);

	r = Math.max(0, Math.min(255, r));
	g = Math.max(0, Math.min(255, g));
	b = Math.max(0, Math.min(255, b));

	// Combine the R, G, and B values using bitwise left shifts and OR operations
	// R is shifted 16 bits to the left to occupy the higher byte positions
	// G is shifted 8 bits to the left to occupy the middle byte positions
	// B occupies the lowest byte positions
	return (((r << 16) | (g << 8) | b) * 256) + 255;
}

function stochastic_color_blobbing(image_in, kernel_size, iterations, reduction) {

	const image_out = image_in.clone();

	for (let i = 0; i < iterations; i++) {

		const x = Math.floor(Math.random() * (image_in.bitmap.width - 0.01));
		const y = Math.floor(Math.random() * (image_in.bitmap.height - 0.01));

		const center_color = get_rgb1(image_out, x, y);

		let sum_color = [0, 0, 0];
		let count = 0;

		// become more like the colors around us that are similar to us
		for (let dx = -kernel_size; dx <= kernel_size; dx++) {
			for (let dy = -kernel_size; dy <= kernel_size; dy++) {
			
				if (x + dx < 0 || y + dy < 0 || x + dx >= image_in.bitmap.width || y + dy >= image_in.bitmap.height)
					continue;

				const neighbor_color = get_rgb1(image_out, x + dx, y + dy);

				if (color_difference(center_color, neighbor_color) < reduction) {
					sum_color[0] += neighbor_color[0];
					sum_color[1] += neighbor_color[1];
					sum_color[2] += neighbor_color[2];
					count++;
				}
			}
		}

		sum_color[0] /= count;
		sum_color[1] /= count;
		sum_color[2] /= count;

		image_out.setPixelColor(rgb1_to_hex(...sum_color), x, y);
	}

	return image_out;
}

function sharpen_outline(image_in, subtleness, exp) {

	const image_out = image_in.clone();

	for (let x = 1; x < image_in.bitmap.width - 1; x++) {
		for (let y = 1; y < image_in.bitmap.height - 1; y++) {

			// for every pixel surrounding this pixel it's significantly darker than, darken this pixel
			const this_c = get_rgb1(image_in, x, y);

			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					
					if (dx == 0 && dy == 0)
						continue;

					const that_c = get_rgb1(image_in, x + dx, y + dy);

					if (this_c[0] < that_c[0] - subtleness && this_c[1] < that_c[1] - subtleness && this_c[2] < that_c[2] - subtleness) {

						const c = get_rgb1(image_out, x, y);

						c[0] += that_c[0];
						c[1] += that_c[1];
						c[2] += that_c[2];

						c[0] /= 2;
						c[1] /= 2;
						c[2] /= 2;

						c[0] = Math.pow(c[0], exp);
						c[1] = Math.pow(c[1], exp);
						c[2] = Math.pow(c[2], exp);

						image_out.setPixelColor(rgb1_to_hex(...c), x, y);
					}
				}
			}
		}
	}

	return image_out;
}

async function run(args) {

	let img = (await Jimp.read(args["--img"])).resize({ h: args["--h"] });

	sharpen_outline(stochastic_color_blobbing(img, 2, 256 * 256 * 40, 0.07), 0.075, 1.7).resize({ h: 256 * 8, mode: ResizeStrategy.NEAREST_NEIGHBOR }).write("output.png");
}

// parse commandline arguments
const args_raw = process.argv.slice(2);
const args = {};

for (const arg of args_raw) {

	if (arg.includes("=")) {

		args[arg.substring(0, arg.indexOf("="))] = arg.substring(arg.indexOf("=") + 1);
	}
}

// push default arguments
if (!args["--img"])
	args["--img"] = "input.png";

args["--h"] = Number(args["--h"]);
if (isNaN(args["--h"]))
	args["--h"] = 256;

run(args);