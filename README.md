# js-i
Store or hide JavaScript in images.
## How to use
Paste JavaScript code into the textbox on the top then choose the method:
- Generate a random image: Generates the most efficient image that can store the code. The image will look like rgb noise.
- Hide code in a selected image: You'll need to select an image file, in which the code will be hidden (using LSB steganography).
  - Image bit count: How many bits to use per pixel per channel (min: 1, max: 8). The lower the bit count, the less noticeable the changes to the original image will be, but also less data can be stored.
  - Fill remaining image with random data: Fill up remaining pixels (that are not used) with random data, to make the image look more uniform (recommended).

Note: transparency is not supported, because canvas operations discard some of the color data when using alpha values lower than 255.

- Embed image data URL: Embed the data URL of the generated image in the generated code, instead of having a separate image file.
  - If this checkbox is unchecked, then you'll need to enter a file name or path where the file will be loaded from. For example, if you plan to put the image in an `images` folder, then you'll need to enter `images/my_image.png` (for the same folder, you can just enter `my_image.png`). Note: the file name must end with `.png`.
- RNG seed: The number used to seed the random number generator. The same seed will generate the same randomness. Leave it empty for a random seed.

After setting the parameters, click Generate to generate the code, which will appear in the bottom textbox.  
To use the generated code, you'll need to save the generated code to a .js file or put it inside a `<script>` tag or whatever; and if you didn't choose to embed the image URL in the code, then you'll also need to put the image file to the path you specified previously. Note: The image must be served from the same origin as the page (or serve with CORS headers), or else you'll get a tainted canvas error. The images also must be saved with lossless compression (.png by default).

Modifying an already existing script only requires you to replace the generated image file (but you must use the same filename and same seed to do so).

You can see a demo page [here](https://kimbatt.github.io/js-i/demopage/).
## Tips
- Hiding the code in a photograph (or other images that should be saved with lossy compression) makes it even harder to notice the hidden data
- For extra fun, run the generated code through [js-Z](https://kimbatt.github.io/js-Z/)!
