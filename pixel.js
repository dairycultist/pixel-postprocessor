// pixel postprocessor

const { Jimp } = require("jimp"); 			// npm install jimp
const { intToRGBA } = require("@jimp/utils");

function get_rgb1(image, x, y) {

	let rgb = intToRGBA(image.getPixelColor(x, y));

	return [rgb.r / 255.0, rgb.g / 255.0, rgb.b / 255.0];
}

function is_transparent(image, x, y) {

	return intToRGBA(image.getPixelColor(x, y)).a == 0;
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

function surface_change(image_in) {

	const image_out = new Jimp({ width: 256, height: 256, color: 0xFFFFFF00 });

	for (let x = 1; x < 255; x++) {
		for (let y = 1; y < 255; y++) {

			if (!is_transparent(image_in, x, y)) {

				let horizontal = color_difference(get_rgb1(image_in, x - 1, y), get_rgb1(image_in, x + 1, y));
				let vertical = color_difference(get_rgb1(image_in, x, y - 1), get_rgb1(image_in, x, y + 1));

				image_out.setPixelColor(rgb1_to_hex(horizontal / 2 + 0.5, vertical / 2 + 0.5, 1), x, y);
			}
		}
	}

	return image_out;
}

function stochastic_color_blobbing(image_in, kernel_size, iterations, reduction) {

	for (let i = 0; i < iterations; i++) {

		const x = Math.floor(Math.random() * 255.99);
		const y = Math.floor(Math.random() * 255.99);

		const center_color = get_rgb1(image_in, x, y);

		let sum_color = [0, 0, 0];
		let count = 0;

		// become more like the colors around us that are similar to us
		for (let dx = -kernel_size; dx <= kernel_size; dx++) {
			for (let dy = -kernel_size; dy <= kernel_size; dy++) {
			
				if (x + dx < 0 || y + dy < 0 || x + dx > 255 || y + dy > 255)
					continue;

				const neighbor_color = get_rgb1(image_in, x + dx, y + dy);

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

		image_in.setPixelColor(rgb1_to_hex(...sum_color), x, y);
	}

	return image_in;
}

async function run() {

	let img = (await Jimp.read("input.png")).resize({ w: 256, h: 256 });

	img = stochastic_color_blobbing(img, 4, 256 * 256 * 10, 0.04);
	// img = surface_change(img);
	
	await img.write("output.png");
}

run();