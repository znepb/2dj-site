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

const canvas = document.getElementById("canvas")
const canvasCtx = canvas.getContext("2d")
const processButton = document.getElementById("process")
const saveButton = document.getElementById("save")
const serpentineDither = document.getElementById("serpentineDither")
const perPageDither = document.getElementById("perPageDither")
const ditherType = document.getElementById("ditherType")
const image = document.getElementById("image")
const manyPages = document.getElementById("manypages")
const specPages = document.getElementById("specpages")
const outputFormat = document.getElementById("outputFormat")
const pagesX = document.getElementById("pagesx")
const pagesY = document.getElementById("pagesy")
const transparency = document.getElementById("transparency")
const pageCanvas = document.getElementById("pageCanvas")
const pageCtx = pageCanvas.getContext("2d")
const automaticLabel = document.getElementById("automaticLabel")
const manualLabel = document.getElementById("manualLabel")
const appendPageInfo = document.getElementById("appendPageInfo")
const manualLabelInput = document.getElementById("manualLabelInput")
const imageInput = document.getElementById("imageInput")
const autoProcess = document.getElementById("autoProcess")

function downloadJSON(obj, name) {
	var dataStr = "data:text/jsoncharset=utf-8," + encodeURIComponent(JSON.stringify(obj))
	var dlAnchorElem = document.getElementById('downloadAnchorElem')
	dlAnchorElem.setAttribute("href", dataStr)
	dlAnchorElem.setAttribute("download", name)
	dlAnchorElem.click()
} // https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser

const PAGE_WIDTH = 128
const PAGE_HEIGHT = 128

var quantizer = new RgbQuant({ colors: 63 })
var size = [PAGE_WIDTH, PAGE_HEIGHT]
var pageW = 1
var pageH = 1
var palette = []
var palettes = []
var paletteImage = []

const processedImageOutput = document.getElementById("processedImage")

const process = () => {
	canvasCtx.fillStyle = "black"
	quantizer = new RgbQuant({ colors: 63 })
	pageW = 1
	pageH = 1
	if (specPages.checked) {
		pageW = pagesX.value
		pageH = pagesY.value
	} else if (manyPages.checked) {
		pageW = Math.max(Math.floor(image.width / PAGE_WIDTH), 1)
		pageH = Math.max(Math.floor(image.height / PAGE_HEIGHT), 1)
	}
	document.getElementById("scaledLabel").innerHTML = "Scaled to " + pageW + " by " + pageH + " pages." + "<br>"
		+ pageH * pageW + " pieces of paper.<br>"
		+ pageH * pageW * 5000 + " ink.<br>"
	var closestWidth = PAGE_WIDTH * pageW
	var closestHeight = PAGE_HEIGHT * pageH
	size = [closestWidth, closestHeight]
	canvas.width = size[0]
	canvas.height = size[1]
	// clear the canvas
	canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
	// draw the image
	canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height)
	// generate the palette
	quantizer.sample(canvas)
	if (!perPageDither.checked) {
		// quantize the image
		var quantizedImage = quantizer.reduce(canvas, null, ditherType.value, serpentineDither.checked)
		// Get palette image
		paletteImage = quantizer.reduce(canvas, 2, ditherType.value, serpentineDither.checked)
		palette = quantizer.palette(true, true)
		// draw it on the canvas
		canvasCtx.putImageData(new ImageData(new Uint8ClampedArray(quantizedImage), canvas.width, canvas.height), 0, 0)
	} else {
		paletteImage = []
		palettes = []
		for (py = 0; py < pageH; py++) {
			palettes[py] = palettes[py] || []
			for (px = 0; px < pageW; px++) {
				pageCtx.drawImage(canvas, px*PAGE_WIDTH, py*PAGE_WIDTH, PAGE_WIDTH, PAGE_HEIGHT, 0, 0, PAGE_WIDTH, PAGE_HEIGHT)
				quantizer = new RgbQuant({ colors: 63 })
				quantizer.sample(pageCanvas)
				var quantImage = quantizer.reduce(pageCanvas, null, ditherType.value, serpentineDither.checked)
				var palImage = quantizer.reduce(pageCanvas, 2, ditherType.value, serpentineDither.checked)
				mergeIntoPaletteImage(px, py, palImage)
				palettes[py][px] = quantizer.palette(true, true)
				canvasCtx.putImageData(new ImageData(new Uint8ClampedArray(quantImage), PAGE_WIDTH, PAGE_HEIGHT), px*PAGE_WIDTH, py*PAGE_HEIGHT)
			}
		}
	}

	if (transparency.checked) {
		// Transfer transparency
		var imageData = canvasCtx.getImageData(0,0,canvas.width,canvas.height)
		for (var y = 0; y < imageData.height; y++) {
			var rowStart = y*imageData.width
			for (var x = 0; x < imageData.width; x++) {
				var index = (x+rowStart)*4 + 3
				if (imageData[index] < 125) { // check for transparent pixels from the source image
					paletteImage[x+rowStart] = -1
				} 
				if (paletteImage[x+rowStart] == null) {
					paletteImage[x+rowStart] = -1
				}
			}
		}
	}

	processedImageOutput.src = canvas.toDataURL("image/png") // show the preview
}

const monitorChanges = [
  serpentineDither,
  perPageDither,
  ditherType,
  manyPages,
  specPages,
  pagesX,
  pagesY,
  transparency,
];

monitorChanges.forEach((element) => {
	element.addEventListener("input", () => {
		if (autoProcess.checked) {
      process();
    }	
	})
})

imageInput.onchange = function (event) {
  var selectedFile = event.target.files[0];

  var reader = new FileReader();

  canvas.title = selectedFile.name;

  reader.onload = function (event) {
    image.src = event.target.result;
  };

  reader.readAsDataURL(selectedFile);

	// for some reason, image inputting won't cause a change unless there's a timeout here
	setTimeout(() => {
		if (autoProcess.checked) {
      process();
    }
	}, 100)
};

function getPaletteIndex(x,y) {
	return x + (y * size[1])
}

function mergeIntoPaletteImage(px,py,image) {
	var pageX = px * PAGE_WIDTH
	var pageY = py * PAGE_HEIGHT
	for (y = 0; y < PAGE_HEIGHT; y++) {
		for (x = 0; x < PAGE_WIDTH; x++) {
			var toIndex = getPaletteIndex(pageX+x, pageY + y)
			var fromIndex = x+(y*PAGE_WIDTH)
			paletteImage[toIndex] = image[fromIndex]
		}
	}
}

processButton.onclick = process;

function getPageIndex(px, py, x, y) {
	return PAGE_WIDTH * pageW * (y + ((py - 1) * PAGE_HEIGHT) - 1) + (px - 1) * PAGE_WIDTH + x - 1
}

function getPixels(px, py) {
	var pixels = []
	for (y = 1; y <= PAGE_HEIGHT; y++) {
		for (x = 1; x <= PAGE_WIDTH; x++) {
			var onPageIndex = getPageIndex(px, py, x, y)
			var paletteIndex = paletteImage[onPageIndex] + 1
			pixels.push(paletteIndex)
		}
	}
	return pixels
}

function getPalette(px,py) {
	var palToUse = palette
	if (perPageDither.checked) {
		palToUse = palettes[py-1][px-1]
	}
	var pal = []
	for (col of palToUse) {
		var color = (col[0] << 16) + (col[1] << 8) + col[2]
		pal.push(color)
	}
	return pal
}

const MAX_LABEL_SIZE = 48

function lengthLimit(name, info) {
	if (name.length + info.length > MAX_LABEL_SIZE) {
		return name.substring(0, MAX_LABEL_SIZE - info.length) + info
	}
	return name + info
}

saveButton.onclick = function (event) {
	var fn = canvas.title.replace(/\.[^/.]+$/, "")
	var pages = []
	var label = fn
	if (manualLabel.checked) {
		label = manualLabelInput.value
	}
	for (var y = 1; y <= pageH; y++) {
		for (var x = 1; x <= pageW; x++) {
			var pageInfo = ""
			if (appendPageInfo.checked) {
				pageInfo = ' : page (' + x + ',' + y + ') of (' + pageW + 'x' + pageH + ')'
			}
			pages.push({
				label: lengthLimit(label, pageInfo),
				palette: getPalette(x,y),
				pixels: getPixels(x, y),
				width: PAGE_WIDTH,
				height: PAGE_HEIGHT
			})
		}
	}
	if (outputFormat.value == "2dj") {
		if (pages.length === 1) {
      downloadJSON(pages[0], fn + ".2dj");
    } else {
      downloadJSON(
        {
          pages: pages,
          width: pageW,
          height: pageH,
          title: fn,
        },
        fn + ".2dja"
      );
    }
	} else if (outputFormat.value == "zip") {
		var zip = new JSZip()
		for (var i = 0; i < pages.length; i++) {
			zip.file(pages[i].label + ".2dj", JSON.stringify(pages[i]))
		}
		zip.generateAsync({ type: "base64" }).then(function (base64) {
			var dataStr = "data:application/zip;base64," + base64
			var dlAnchorElem = document.getElementById('downloadAnchorElem')
			dlAnchorElem.setAttribute("href", dataStr)
			dlAnchorElem.setAttribute("download", fn + ".2dj.zip")
			dlAnchorElem.click()
		});
	}
}