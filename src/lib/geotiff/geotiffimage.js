function arrayForType(format, bitsPerSample, size) {
  switch (format) {
    case 1:
      switch (bitsPerSample) {
        case 8:
          return new Uint8Array(size);
        case 16:
          return new Uint16Array(size);
        case 32:
          return new Uint32Array(size);
        default:
          break;
      }
      break;
    case 2:
      switch (bitsPerSample) {
        case 8:
          return new Int8Array(size);
        case 16:
          return new Int16Array(size);
        case 32:
          return new Int32Array(size);
        default:
          break;
      }
      break;
    case 3:
      switch (bitsPerSample) {
        case 32:
          return new Float32Array(size);
        case 64:
          return new Float64Array(size);
        default:
          break;
      }
      break;
    default:
      break;
  }
  throw Error("Unsupported data format/bitsPerSample");
}

class GeoTIFFImage {
  constructor(fileDirectory, geoKeys, littleEndian, cache, source) {
    this.fileDirectory = fileDirectory;
    this.geoKeys = geoKeys;
    this.littleEndian = littleEndian;
    this.tiles = cache ? {} : null;
    this.isTiled = !fileDirectory.StripOffsets;
    const planarConfiguration = fileDirectory.PlanarConfiguration;
    this.planarConfiguration =
      typeof planarConfiguration === "undefined" ? 1 : planarConfiguration;
    if (this.planarConfiguration !== 1 && this.planarConfiguration !== 2) {
      throw new Error("Invalid planar configuration.");
    }

    this.source = source;
  }

  getFileDirectory() {
    return this.fileDirectory;
  }

  getGeoKeys() {
    return this.geoKeys;
  }

  getWidth() {
    return this.fileDirectory.ImageWidth;
  }

  getHeight() {
    return this.fileDirectory.ImageLength;
  }

  getSamplesPerPixel() {
    return this.fileDirectory.SamplesPerPixel;
  }

  getTileWidth() {
    return this.isTiled ? this.fileDirectory.TileWidth : this.getWidth();
  }

  getTileHeight() {
    if (this.isTiled) {
      return this.fileDirectory.TileLength;
    }
    if (typeof this.fileDirectory.RowsPerStrip !== "undefined") {
      return Math.min(this.fileDirectory.RowsPerStrip, this.getHeight());
    }
    return this.getHeight();
  }

  getBytesPerPixel() {
    let bitsPerSample = 0;
    for (let i = 0; i < this.fileDirectory.BitsPerSample.length; ++i) {
      const bits = this.fileDirectory.BitsPerSample[i];
      if (bits % 8 !== 0) {
        throw new Error(`Sample bit-width of ${bits} is not supported.`);
      } else if (bits !== this.fileDirectory.BitsPerSample[0]) {
        throw new Error(
          "Differing size of samples in a pixel are not supported.",
        );
      }
      bitsPerSample += bits;
    }
    return bitsPerSample / 8;
  }

  getSampleByteSize(i) {
    if (i >= this.fileDirectory.BitsPerSample.length) {
      throw new RangeError(`Sample index ${i} is out of range.`);
    }
    const bits = this.fileDirectory.BitsPerSample[i];
    if (bits % 8 !== 0) {
      throw new Error(`Sample bit-width of ${bits} is not supported.`);
    }
    return bits / 8;
  }

  getReaderForSample(sampleIndex) {
    const format = this.fileDirectory.SampleFormat
      ? this.fileDirectory.SampleFormat[sampleIndex]
      : 1;
    const bitsPerSample = this.fileDirectory.BitsPerSample[sampleIndex];
    switch (format) {
      case 1:
        switch (bitsPerSample) {
          case 8:
            return DataView.prototype.getUint8;
          case 16:
            return DataView.prototype.getUint16;
          case 32:
            return DataView.prototype.getUint32;
          default:
            break;
        }
        break;
      case 2:
        switch (bitsPerSample) {
          case 8:
            return DataView.prototype.getInt8;
          case 16:
            return DataView.prototype.getInt16;
          case 32:
            return DataView.prototype.getInt32;
          default:
            break;
        }
        break;
      case 3:
        switch (bitsPerSample) {
          case 32:
            return DataView.prototype.getFloat32;
          case 64:
            return DataView.prototype.getFloat64;
          default:
            break;
        }
        break;
      default:
        break;
    }
    throw Error("Unsupported data format/bitsPerSample");
  }

  getArrayForSample(sampleIndex, size) {
    const format = this.fileDirectory.SampleFormat
      ? this.fileDirectory.SampleFormat[sampleIndex]
      : 1;
    const bitsPerSample = this.fileDirectory.BitsPerSample[sampleIndex];
    return arrayForType(format, bitsPerSample, size);
  }

  getTiePoints() {
    if (!this.fileDirectory.ModelTiepoint) {
      return [];
    }

    const tiePoints = [];
    for (let i = 0; i < this.fileDirectory.ModelTiepoint.length; i += 6) {
      tiePoints.push({
        i: this.fileDirectory.ModelTiepoint[i],
        j: this.fileDirectory.ModelTiepoint[i + 1],
        k: this.fileDirectory.ModelTiepoint[i + 2],
        x: this.fileDirectory.ModelTiepoint[i + 3],
        y: this.fileDirectory.ModelTiepoint[i + 4],
        z: this.fileDirectory.ModelTiepoint[i + 5],
      });
    }
    return tiePoints;
  }

  getOrigin() {
    const tiePoints = this.fileDirectory.ModelTiepoint;
    const modelTransformation = this.fileDirectory.ModelTransformation;
    if (tiePoints && tiePoints.length === 6) {
      return [tiePoints[3], tiePoints[4], tiePoints[5]];
    }
    if (modelTransformation) {
      return [
        modelTransformation[3],
        modelTransformation[7],
        modelTransformation[11],
      ];
    }
    throw new Error("The image does not have an affine transformation.");
  }

  getResolution(referenceImage = null) {
    const modelPixelScale = this.fileDirectory.ModelPixelScale;
    const modelTransformation = this.fileDirectory.ModelTransformation;

    if (modelPixelScale) {
      return [modelPixelScale[0], -modelPixelScale[1], modelPixelScale[2]];
    }
    if (modelTransformation) {
      return [
        modelTransformation[0],
        modelTransformation[5],
        modelTransformation[10],
      ];
    }

    if (referenceImage) {
      const [refResX, refResY, refResZ] = referenceImage.getResolution();
      return [
        (refResX * referenceImage.getWidth()) / this.getWidth(),
        (refResY * referenceImage.getHeight()) / this.getHeight(),
        (refResZ * referenceImage.getWidth()) / this.getWidth(),
      ];
    }

    throw new Error("The image does not have an affine transformation.");
  }

  pixelIsArea() {
    return this.geoKeys.GTRasterTypeGeoKey === 1;
  }

  getBoundingBox() {
    const origin = this.getOrigin();
    const resolution = this.getResolution();

    const x1 = origin[0];
    const y1 = origin[1];

    const x2 = x1 + resolution[0] * this.getWidth();
    const y2 = y1 + resolution[1] * this.getHeight();

    return [
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2),
    ];
  }
}

export default GeoTIFFImage;
