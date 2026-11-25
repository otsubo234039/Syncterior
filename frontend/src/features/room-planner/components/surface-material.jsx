import React, { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import { useLoader } from '@react-three/fiber';
import { surfacePresets } from '../data/surfaces';

function drawPattern(kind, preset) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = surfacePresets[kind][preset].color;
  context.fillRect(0, 0, 128, 128);

  if (kind === 'floor' && preset === 'wood') {
    context.strokeStyle = '#b99f77';
    for (let y = 8; y < 128; y += 32) {
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(32, y - 5, 82, y + 8, 128, y);
      context.stroke();
    }
  } else if (kind === 'floor' && preset === 'oak') {
    context.fillStyle = '#c3a984';
    for (let y = 0; y < 128; y += 32) context.fillRect(0, y, 128, 3);
    context.fillStyle = '#9f8158';
    for (let x = 0; x < 128; x += 64) context.fillRect(x, 0, 2, 128);
  } else if (kind === 'floor' && preset === 'stone') {
    context.strokeStyle = '#888d86';
    context.lineWidth = 2;
    context.strokeRect(2, 2, 124, 124);
    context.beginPath();
    context.moveTo(64, 2); context.lineTo(64, 126);
    context.moveTo(2, 64); context.lineTo(126, 64);
    context.stroke();
  } else if (kind === 'wall' && preset !== 'white') {
    context.globalAlpha = .08;
    context.fillStyle = '#5f675f';
    for (let y = 0; y < 128; y += 16) context.fillRect(0, y, 128, 1);
  }
  return canvas;
}

export function SurfaceMaterial({ kind, preset, repeat = [4, 4], roughness = 1, side }) {
  const surface = surfacePresets[kind][preset];
  if (surface.image) return <ImageSurfaceMaterial image={surface.image} repeat={repeat} rotation={surface.rotation ?? 0} roughness={roughness} side={side} />;
  return <PatternSurfaceMaterial kind={kind} preset={preset} repeat={repeat} roughness={roughness} side={side} />;
}

function ImageSurfaceMaterial({ image, repeat, rotation, roughness, side }) {
  const loadedTexture = useLoader(TextureLoader, image);
  const texture = useMemo(() => loadedTexture.clone(), [loadedTexture]);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  const quarterTurn = Math.abs(rotation) === Math.PI / 2;
  texture.repeat.set(quarterTurn ? repeat[1] : repeat[0], quarterTurn ? repeat[0] : repeat[1]);
  texture.center.set(.5, .5);
  texture.rotation = rotation;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  useEffect(() => () => texture.dispose(), [texture]);
  return <meshStandardMaterial map={texture} roughness={roughness} side={side} />;
}

function PatternSurfaceMaterial({ kind, preset, repeat, roughness, side }) {
  const texture = useMemo(() => {
    const value = new CanvasTexture(drawPattern(kind, preset));
    value.wrapS = value.wrapT = RepeatWrapping;
    value.repeat.set(repeat[0], repeat[1]);
    value.colorSpace = SRGBColorSpace;
    value.needsUpdate = true;
    return value;
  }, [kind, preset, repeat[0], repeat[1]]);

  useEffect(() => () => texture.dispose(), [texture]);
  return <meshStandardMaterial map={texture} roughness={roughness} side={side} />;
}
