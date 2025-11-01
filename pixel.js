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

function edge(image_in, threshold = 0.5) {

	const image_out = new Jimp({ width: 256, height: 256, color: 0x000000FF });

	for (let x = 1; x < 255; x++) {
		for (let y = 1; y < 255; y++) {

			if (!is_transparent(image_in, x, y)) {

				// calculate delta color
				let horizontal = color_difference(get_rgb1(image_in, x - 1, y), get_rgb1(image_in, x + 1, y));
				let vertical = color_difference(get_rgb1(image_in, x, y - 1), get_rgb1(image_in, x, y + 1));

				let c = Math.sqrt(Math.pow(horizontal, 2) + Math.pow(vertical, 2));

				c = c > threshold ? 1 : 0;

				image_out.setPixelColor(rgb1_to_hex(c, c, c), x, y);
			}
		}
	}

	return image_out;
}

function thin(image_in) {

	const image_out = image_in.clone();

	// https://homepages.inf.ed.ac.uk/rbf/HIPR2/thin.htm
	const struct_elems = [
		[
			[  0,   0,   0],
			[NaN,   1, NaN],
			[  1,   1,   1],
		],
		[
			[NaN,   0,   0],
			[  1,   1,   0],
			[NaN,   1, NaN],
		],
		[
			[  1, NaN,   0],
			[  1,   1,   0],
			[  1, NaN,   0],
		],
		[
			[NaN,   1, NaN],
			[  1,   1,   0],
			[NaN,   0,   0],
		],
		[
			[  1,   1,   1],
			[NaN,   1, NaN],
			[  0,   0,   0],
		],
		[
			[NaN,   1, NaN],
			[  0,   1,   1],
			[  0,   0, NaN],
		],
		[
			[  0, NaN,   1],
			[  0,   1,   1],
			[  0, NaN,   1],
		],
		[
			[  0,   0, NaN],
			[  0,   1,   1],
			[NaN,   1, NaN],
		],
	];

	const matches = (struct_elem, x, y) => {

		for (let row = 0; row < 3; row++) {
			for (let col = 0; col < 3; col++) {

				if (!isNaN(struct_elem[row][col])) {

					if (struct_elem[row][col] != get_rgb1(image_out, x + col - 1, y + row - 1)[0])
						return false;
				}
			}
		}

		return true;
	};

	for (const struct_elem of struct_elems) {

		for (let x = 1; x < 255; x++) {
			for (let y = 1; y < 255; y++) {
			
				if (matches(struct_elem, x, y))
					image_out.setPixelColor(rgb1_to_hex(0, 0, 0), x, y);
			}
		}
	}

	return image_out;
}

function stochastic_color_blobbing(image_in, kernel_size, iterations, reduction) {

	const image_out = image_in.clone();

	for (let i = 0; i < iterations; i++) {

		const x = Math.floor(Math.random() * 255.99);
		const y = Math.floor(Math.random() * 255.99);

		const center_color = get_rgb1(image_out, x, y);

		let sum_color = [0, 0, 0];
		let count = 0;

		// become more like the colors around us that are similar to us
		for (let dx = -kernel_size; dx <= kernel_size; dx++) {
			for (let dy = -kernel_size; dy <= kernel_size; dy++) {
			
				if (x + dx < 0 || y + dy < 0 || x + dx > 255 || y + dy > 255)
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

function sharpen_outline(image_in) {

	const image_out = image_in.clone();

	for (let x = 1; x < 255; x++) {
		for (let y = 1; y < 255; y++) {

			// for every pixel surrounding this pixel it's significantly darker than, darken this pixel
			const factor = 0.08;

			const this_c = get_rgb1(image_in, x, y);

			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					
					if (dx == 0 && dy == 0)
						continue;

					const that_c = get_rgb1(image_in, x + dx, y + dy);

					if (this_c[0] < that_c[0] - factor && this_c[1] < that_c[1] - factor && this_c[2] < that_c[2] - factor) {

						const c = get_rgb1(image_out, x, y);

						c[0] += that_c[0];
						c[1] += that_c[1];
						c[2] += that_c[2];

						c[0] *= 0.4;
						c[1] *= 0.4;
						c[2] *= 0.4;

						image_out.setPixelColor(rgb1_to_hex(...c), x, y);
					}
				}
			}
		}
	}

	return image_out;
}

async function run() {

	let base_img = (await Jimp.read("input.png")).resize({ w: 256, h: 256 });

	let color_img = stochastic_color_blobbing(base_img, 2, 256 * 256 * 40, 0.07);

	// let border_img = thin(thin(thin(thin(edge(deartifact(color_img, 0.2), 0.07)))));

	let final_img = sharpen_outline(color_img);

	// for (let x = 1; x < 255; x++) {
	// 	for (let y = 1; y < 255; y++) {

	// 		if (get_rgb1(border_img, x, y)[0] == 1)
	// 			final_img.setPixelColor(rgb1_to_hex(0, 0, 0), x, y);
	// 	}
	// }
	
	await final_img.write("output.png");
}

run();