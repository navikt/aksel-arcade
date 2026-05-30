#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const sourceIconPath = join(rootDir, 'public', 'aksel-favicon.svg')
const outputDir = join(rootDir, 'build', 'desktop')
const iconSizes = [16, 32, 48, 64, 128, 256, 512, 1024]

const renderPng = (svg, size) =>
  new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  })
    .render()
    .asPng()

const createIco = (pngsBySize) => {
  const sizes = [16, 32, 48, 64, 128, 256]
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  const directory = Buffer.alloc(16 * sizes.length)
  let imageOffset = header.length + directory.length
  const images = []

  sizes.forEach((size, index) => {
    const image = pngsBySize.get(size)
    if (!image) {
      throw new Error(`Missing ${size}px PNG while creating Windows icon.`)
    }

    const entryOffset = index * 16
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset)
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset + 1)
    directory.writeUInt8(0, entryOffset + 2)
    directory.writeUInt8(0, entryOffset + 3)
    directory.writeUInt16LE(1, entryOffset + 4)
    directory.writeUInt16LE(32, entryOffset + 6)
    directory.writeUInt32LE(image.length, entryOffset + 8)
    directory.writeUInt32LE(imageOffset, entryOffset + 12)

    imageOffset += image.length
    images.push(image)
  })

  return Buffer.concat([header, directory, ...images])
}

const createIcnsChunk = (type, image) => {
  const header = Buffer.alloc(8)
  header.write(type, 0, 4, 'ascii')
  header.writeUInt32BE(image.length + header.length, 4)
  return Buffer.concat([header, image])
}

const createIcns = (pngsBySize) => {
  const entries = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
    ['ic11', 32],
    ['ic12', 64],
    ['ic13', 256],
    ['ic14', 512],
  ]

  const chunks = entries.map(([type, size]) => {
    const image = pngsBySize.get(size)
    if (!image) {
      throw new Error(`Missing ${size}px PNG while creating macOS icon.`)
    }

    return createIcnsChunk(type, image)
  })
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(body.length + header.length, 4)
  return Buffer.concat([header, body])
}

const svg = await readFile(sourceIconPath, 'utf8')
const pngsBySize = new Map(iconSizes.map((size) => [size, renderPng(svg, size)]))

await mkdir(outputDir, { recursive: true })
await Promise.all([
  writeFile(join(outputDir, 'icon.svg'), svg),
  writeFile(join(outputDir, 'icon.png'), pngsBySize.get(1024)),
  writeFile(join(outputDir, 'icon.ico'), createIco(pngsBySize)),
  writeFile(join(outputDir, 'icon.icns'), createIcns(pngsBySize)),
])

console.log('Desktop icons generated in build/desktop from public/aksel-favicon.svg')
