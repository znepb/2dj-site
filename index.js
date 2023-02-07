function rgbArrToRgbTuples(arr) {
	var newArr = []
	for (fullrgb of arr) {
		newArr.push([
			fullrgb >> 16,
			(fullrgb >> 8) & 0xFF,
			fullrgb & 0xFF,
		])
	}
	return newArr
}

function ready() {
	const canvas = document.getElementById("canvas");
	const canvasCtx = canvas.getContext("2d");
	const processButton = document.getElementById("process");
	const saveButton = document.getElementById("save");
	const serpentineDither = document.getElementById("serpentineDither")
	const ditherType = document.getElementById("ditherType");
	const image = document.getElementById("image");
	const onlyOnePage = document.getElementById("onepage");
	const manyPages = document.getElementById("manypages");
	const specPages = document.getElementById("specpages");
	const pagesX = document.getElementById("pagesx");
	const pagesY = document.getElementById("pagesy");

	function downloadJSON(obj, name) {
		var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj));
		var dlAnchorElem = document.getElementById('downloadAnchorElem');
		dlAnchorElem.setAttribute("href",     dataStr     );
		dlAnchorElem.setAttribute("download", name);
		dlAnchorElem.click();
	} // https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser

	const PAGE_WIDTH = 128
	const PAGE_HEIGHT = 128

	var quantizer = new RgbQuant({colors: 63});
	var size = [PAGE_WIDTH,PAGE_HEIGHT];
	var pageW = 1;
	var pageH = 1;
	var palette = [];
	var paletteImage = [];

	const processedImageOutput = document.getElementById("processedImage");

	document.getElementById('imageInput').onchange = function (event) {
		var selectedFile = event.target.files[0];
		var reader = new FileReader();
	
		canvas.title = selectedFile.name;
	
		reader.onload = function(event) {
			image.src = event.target.result;
		};
		
		reader.readAsDataURL(selectedFile);
	}

	processButton.onclick = function(event) {
		canvasCtx.fillStyle = "black";
		quantizer = new RgbQuant({colors: 63});
		pageW = 1;
		pageH = 1;
		if (specPages.checked) {
			pageW = pagesX.value;
			pageH = pagesY.value;
		} else if (manyPages.checked) {
			pageW = Math.max(Math.floor(image.width / PAGE_WIDTH), 1);
			pageH = Math.max(Math.floor(image.height / PAGE_HEIGHT),1);
		}
		document.getElementById("scaledLabel").innerHTML = "Scaled to " + pageW + " by " + pageH + " pages." + "<br>"
			+ pageH * pageW + " pieces of paper.<br>"
			+ pageH * pageW * 5000 + " ink.<br>"
		var closestWidth = PAGE_WIDTH * pageW;
		var closestHeight = PAGE_HEIGHT * pageH;
		size = [closestWidth, closestHeight];
		canvas.width = size[0]
		canvas.height = size[1]
		// clear the canvas
		canvasCtx.fillRect(0,0,canvas.width,canvas.height);
		// draw the image
		canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
		// generate the palette
		quantizer.sample(canvas);
		// quantize the image
		var quantizedImage = quantizer.reduce(canvas, null, ditherType.value, serpentineDither.checked);
		paletteImage = quantizer.reduce(canvas, 2, ditherType.value, serpentineDither.checked);
		palette = quantizer.palette(true, true)
		// draw it on the canvas
		canvasCtx.putImageData(new ImageData(new Uint8ClampedArray(quantizedImage), canvas.width, canvas.height), 0, 0);

		processedImageOutput.src = canvas.toDataURL("image/png"); // show the preview
	};

	function getPageIndex(px,py,x,y) {
		return PAGE_WIDTH*pageW*(y+((py-1)*PAGE_HEIGHT)-1) + (px-1)*PAGE_WIDTH + x-1
	}

	function getPixels(px,py) {
		var pixels = []
		for (y = 1; y <= PAGE_HEIGHT; y++) {
			for (x = 1; x <= PAGE_WIDTH; x++) {
				var onPageIndex = getPageIndex(px,py,x,y);
				var paletteIndex = paletteImage[onPageIndex] + 1
				pixels.push(paletteIndex)
			}
		}
		return pixels
	}

	function getPalette() {
		var pal = []
		for (col of palette) {
			var color = (col[0]<<16) + (col[1]<<8) + col[2]
			pal.push(color)
		}
		return pal
	}

	const MAX_LABEL_SIZE = 48

	function lengthLimit(name, info) {
		if (name.length + info.length > MAX_LABEL_SIZE) {
			return name.substring(0,MAX_LABEL_SIZE-info.length) + info
		}
		return name + info
	}

	saveButton.onclick = function(event) {
		var fn = canvas.title.replace(/\.[^/.]+$/, "")
		var pages = []
		console.log(pageW,pageH)
		for (var y = 1; y <= pageH; y++) {
			for (var x = 1; x <= pageW; x++) {
				console.log(x,y)
				pages.push({
					label: lengthLimit(fn, ' : page ('+ x + ','+ y + ') of (' + pageW + 'x' + pageH + ').'),
					palette: getPalette(),
					pixels: getPixels(x,y),
					width: PAGE_WIDTH,
					height: PAGE_HEIGHT
				})
			}
		}
		if (onlyOnePage.checked) {
			downloadJSON(pages[0], fn+".2dj")
		} else {
			downloadJSON({
				pages: pages,
				width: pageW,
				height: pageH,
				title: fn,
			}, fn+".2dja")
		}
	}

}