function rgbArrToRgbTuples(arr) {
  return arr.map((fullrgb) => [
    fullrgb >> 16,
    (fullrgb >> 8) & 0xff,
    fullrgb & 0xff,
  ]);
}

const canvas = document.querySelector("#canvas");
const processButton = document.querySelector("#process");
const saveButton = document.querySelector("#save");
const serpentineDither = document.querySelector("#serpentineDither");
const perPageDither = document.querySelector("#perPageDither");
const ditherType = document.querySelector("#ditherType");
const image = document.querySelector("#image");
const manyPages = document.querySelector("#manypages");
const specPages = document.querySelector("#specpages");
const outputFormat = document.querySelector("#outputFormat");
const pagesX = document.querySelector("#pagesx");
const pagesY = document.querySelector("#pagesy");
const transparency = document.querySelector("#transparency");
const pageCanvas = document.querySelector("#pageCanvas");
const automaticLabel = document.querySelector("#automaticLabel");
const manualLabel = document.querySelector("#manualLabel");
const appendPageInfo = document.querySelector("#appendPageInfo");
const manualLabelInput = document.querySelector("#manualLabelInput");
const imageInput = document.querySelector("#imageInput");
const autoProcess = document.querySelector("#autoProcess");
const downloadAnchor = document.querySelector("#downloadAnchorElem");
const processedImageOutput = document.querySelector("#processedImage");
const scaledLabel = document.querySelector("#scaledLabel");
const pageCtx = pageCanvas.getContext("2d");
const canvasCtx = canvas.getContext("2d");

function downloadJSON(obj, name) {
  const dataStr =
    "data:text/jsoncharset=utf-8," + encodeURIComponent(JSON.stringify(obj));

  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", name);
  downloadAnchor.click();
} // https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser

const PAGE_WIDTH = 128;
const PAGE_HEIGHT = 128;

let size = [PAGE_WIDTH, PAGE_HEIGHT];
let pageW = 1;
let pageH = 1;
let palette = [];
let palettes = [];
let paletteImage = [];

function process() {
  canvasCtx.fillStyle = "black";
  let quantizer = new RgbQuant({ colors: 63 });
  pageW = 1;
  pageH = 1;

  if (specPages.checked) {
    pageW = pagesX.value;
    pageH = pagesY.value;
  } else if (manyPages.checked) {
    pageW = Math.max(Math.floor(image.width / PAGE_WIDTH), 1);
    pageH = Math.max(Math.floor(image.height / PAGE_HEIGHT), 1);
  }

  scaledLabel.innerHTML = `Scaled to ${pageW} by ${pageH} pages.<br>
  ${pageH * pageW} pieces of paper.<br> ${pageH * pageW * 5000} ink.<br>`;

  size = [PAGE_WIDTH * pageW, PAGE_HEIGHT * pageH];
  canvas.width = size[0];
  canvas.height = size[1];

  // clear the canvas
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  // draw the image
  canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
  // generate the palette
  quantizer.sample(canvas);

  if (!perPageDither.checked) {
    // quantize the image
    const quantizedImage = quantizer.reduce(
      canvas,
      null,
      ditherType.value,
      serpentineDither.checked
    );

    // Get palette image
    paletteImage = quantizer.reduce(
      canvas,
      2,
      ditherType.value,
      serpentineDither.checked
    );
    palette = quantizer.palette(true, true);

    // draw it on the canvas
    canvasCtx.putImageData(
      new ImageData(
        new Uint8ClampedArray(quantizedImage),
        canvas.width,
        canvas.height
      ),
      0,
      0
    );
  } else {
    paletteImage = [];
    palettes = [];

    for (let py = 0; py < pageH; py++) {
      palettes[py] = palettes[py] || [];

      for (let px = 0; px < pageW; px++) {
        pageCtx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        pageCtx.drawImage(
          canvas,
          px * PAGE_WIDTH,
          py * PAGE_WIDTH,
          PAGE_WIDTH,
          PAGE_HEIGHT,
          0,
          0,
          PAGE_WIDTH,
          PAGE_HEIGHT
        );

        quantizer = new RgbQuant({ colors: 63 });
        quantizer.sample(pageCanvas);

        const quantImage = quantizer.reduce(
          pageCanvas,
          null,
          ditherType.value,
          serpentineDither.checked
        );
        const palImage = quantizer.reduce(
          pageCanvas,
          2,
          ditherType.value,
          serpentineDither.checked
        );

        mergeIntoPaletteImage(px, py, palImage);
        palettes[py][px] = quantizer.palette(true, true);

        canvasCtx.putImageData(
          new ImageData(
            new Uint8ClampedArray(quantImage),
            PAGE_WIDTH,
            PAGE_HEIGHT
          ),
          px * PAGE_WIDTH,
          py * PAGE_HEIGHT
        );
      }
    }
  }

  if (transparency.checked) {
    // Transfer transparency
    const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < imageData.height; y++) {
      const rowStart = y * imageData.width;

      for (let x = 0; x < imageData.width; x++) {
        const index = (x + rowStart) * 4 + 3;
        if (imageData[index] < 125) {
          // check for transparent pixels from the source image
          paletteImage[x + rowStart] = -1;
        }

        if (paletteImage[x + rowStart] === null) {
          paletteImage[x + rowStart] = -1;
        }
      }
    }
  }

  processedImageOutput.src = canvas.toDataURL("image/png"); // show the preview
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
  });
});

imageInput.onchange = (event) => {
  const selectedFile = event.target.files[0];
  const reader = new FileReader();

  canvas.title = selectedFile.name;

  reader.onload = (event) => {
    image.src = event.target.result;
  };

  reader.readAsDataURL(selectedFile);

  // for some reason, image inputting won't cause a change unless there's a timeout here
  setTimeout(() => {
    if (autoProcess.checked) {
      process();
    }
  }, 100);
};

function getPaletteIndex(x, y) {
  return x + y * size[1];
}

function mergeIntoPaletteImage(px, py, image) {
  var pageX = px * PAGE_WIDTH;
  var pageY = py * PAGE_HEIGHT;
  for (y = 0; y < PAGE_HEIGHT; y++) {
    for (x = 0; x < PAGE_WIDTH; x++) {
      var toIndex = getPaletteIndex(pageX + x, pageY + y);
      var fromIndex = x + y * PAGE_WIDTH;
      paletteImage[toIndex] = image[fromIndex];
    }
  }
}

processButton.onclick = process;

function getPageIndex(px, py, x, y) {
  return (
    PAGE_WIDTH * pageW * (y + (py - 1) * PAGE_HEIGHT - 1) +
    (px - 1) * PAGE_WIDTH +
    x -
    1
  );
}

function getPixels(px, py) {
  const pixels = [];

  for (y = 1; y <= PAGE_HEIGHT; y++) {
    for (x = 1; x <= PAGE_WIDTH; x++) {
      const onPageIndex = getPageIndex(px, py, x, y);
      const paletteIndex = paletteImage[onPageIndex] + 1;
      pixels.push(paletteIndex);
    }
  }

  return pixels;
}

function getPalette(px, py) {
  let palToUse = palette;

  if (perPageDither.checked) {
    palToUse = palettes[py - 1][px - 1];
  }

  return palToUse.map((col) => (col[0] << 16) + (col[1] << 8) + col[2]);
}

const MAX_LABEL_SIZE = 48;

function lengthLimit(name, info) {
  if (name.length + info.length > MAX_LABEL_SIZE) {
    return name.substring(0, MAX_LABEL_SIZE - info.length) + info;
  }

  return name + info;
}

saveButton.onclick = () => {
  const fn = canvas.title.replace(/\.[^/.]+$/, "");
  const pages = [];
  let label = fn;

  if (manualLabel.checked) {
    label = manualLabelInput.value;
  }

  for (var y = 1; y <= pageH; y++) {
    for (var x = 1; x <= pageW; x++) {
      let pageInfo = "";
      if (appendPageInfo.checked) {
        pageInfo = ` : page (${x}, ${y}) of (${pageW}x${pageH})`;
      }

      pages.push({
        label: lengthLimit(label, pageInfo),
        palette: getPalette(x, y),
        pixels: getPixels(x, y),
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      });
    }
  }

  if (outputFormat.value === "2dj") {
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
    const zip = new JSZip();

    pages.forEach((page) => {
      zip.file(page.label + ".2dj", JSON.stringify(page));
    });

    zip.generateAsync({ type: "base64" }).then(function (base64) {
      const dataStr = "data:application/zip;base64," + base64;
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", fn + ".2dj.zip");
      downloadAnchor.click();
    });
  }
};
