import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { sound } from '../../utils/audio.ts';

// Generate circular soft glowing particle sprite texture
function createParticleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(0, 243, 255, 0.9)');
  gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const ParticleBackground: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 85;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Dynamic Particle Constellation
    const particleCount = 650;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const initialPositions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const palette = [
      new THREE.Color(0x00f3ff), // Neon Cyan
      new THREE.Color(0xa855f7), // Electric Purple
      new THREE.Color(0xf43f5e), // Cyber Pink
      new THREE.Color(0x10b981), // Emerald Green
      new THREE.Color(0x38bdf8), // Sky Blue
    ];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Cylindrical/spherical dispersion
      const radius = 20 + Math.random() * 85;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      const x = radius * Math.cos(theta) * Math.cos(phi);
      const y = radius * Math.sin(phi);
      const z = radius * Math.sin(theta) * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      initialPositions[i3] = x;
      initialPositions[i3 + 1] = y;
      initialPositions[i3 + 2] = z;

      velocities[i3] = (Math.random() - 0.5) * 0.04;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.04;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.04;

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = 1.4 + Math.random() * 2.8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleTexture = createParticleTexture();

    const material = new THREE.PointsMaterial({
      size: 2.8,
      map: particleTexture,
      transparent: true,
      opacity: 0.75,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);

    // Dynamic Connecting Wave Lines
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(particleCount * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending
    });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineSegments);

    // 4. Mouse Tracking
    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      mousePosRef.current.targetX = normX * 45;
      mousePosRef.current.targetY = normY * 35;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 5. Animation Loop with Audio Frequency & Mouse Reactivity
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse interpolation
      mousePosRef.current.x += (mousePosRef.current.targetX - mousePosRef.current.x) * 0.05;
      mousePosRef.current.y += (mousePosRef.current.targetY - mousePosRef.current.y) * 0.05;

      // Extract Audio Frequency data
      const audioEnergy = sound.getAudioEnergy();
      const freqData = sound.getAudioFrequencyData();
      const isMusicPlaying = sound.isBackgroundMusicPlaying();

      // Reactivity multipliers
      const bassBoost = audioEnergy.bass * 2.8;
      const overallBoost = audioEnergy.overall * 2.2;
      const energyPulse = 1.0 + (isMusicPlaying ? overallBoost * 1.2 : 0.2 * Math.sin(elapsedTime * 2));

      // Global slow rotation
      particlesMesh.rotation.y = elapsedTime * 0.04 + (mousePosRef.current.x * 0.005);
      particlesMesh.rotation.x = elapsedTime * 0.02 + (mousePosRef.current.y * 0.005);

      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      const mouse3DX = mousePosRef.current.x;
      const mouse3DY = mousePosRef.current.y;

      let lineVertexIdx = 0;
      const maxConnectDist = 14 + bassBoost * 10;
      const maxLines = 180;
      let connectedLines = 0;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        let px = initialPositions[i3];
        let py = initialPositions[i3 + 1];
        let pz = initialPositions[i3 + 2];

        // Audio Wave Modulation
        let freqFactor = 1.0;
        if (freqData && freqData.length > 0) {
          const binIdx = i % freqData.length;
          freqFactor = 1.0 + (freqData[binIdx] / 255) * 0.7;
        }

        // Expand cloud on bass hits
        const audioRadialScale = 1.0 + bassBoost * 0.45;
        px *= audioRadialScale * freqFactor;
        py *= audioRadialScale * freqFactor;
        pz *= audioRadialScale * freqFactor;

        // Harmonic organic floating wave
        px += Math.sin(elapsedTime * 1.2 + i * 0.1) * (1.5 + bassBoost * 3.0);
        py += Math.cos(elapsedTime * 1.4 + i * 0.12) * (1.5 + bassBoost * 3.0);
        pz += Math.sin(elapsedTime * 0.9 + i * 0.08) * (1.5 + bassBoost * 2.0);

        // Mouse Gravitational Vortex Influence
        const dx = mouse3DX - px;
        const dy = mouse3DY - py;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);

        if (distToMouse < 40) {
          const force = (1 - distToMouse / 40) * 8.0;
          px -= (dx / (distToMouse + 0.001)) * force;
          py -= (dy / (distToMouse + 0.001)) * force;
        }

        posArray[i3] = px;
        posArray[i3 + 1] = py;
        posArray[i3 + 2] = pz;

        // Connect nearby particles with glowing cyber lines
        if (connectedLines < maxLines && i < 60) {
          for (let j = i + 1; j < Math.min(i + 12, particleCount); j++) {
            const j3 = j * 3;
            const jx = posArray[j3];
            const jy = posArray[j3 + 1];
            const jz = posArray[j3 + 2];

            const distSq = (px - jx) ** 2 + (py - jy) ** 2 + (pz - jz) ** 2;
            if (distSq < maxConnectDist ** 2) {
              linePositions[lineVertexIdx++] = px;
              linePositions[lineVertexIdx++] = py;
              linePositions[lineVertexIdx++] = pz;
              linePositions[lineVertexIdx++] = jx;
              linePositions[lineVertexIdx++] = jy;
              linePositions[lineVertexIdx++] = jz;
              connectedLines++;
              if (connectedLines >= maxLines) break;
            }
          }
        }
      }

      posAttr.needsUpdate = true;

      // Update Line connections
      lineGeo.setDrawRange(0, lineVertexIdx / 3);
      lineGeo.attributes.position.needsUpdate = true;
      lineMat.opacity = Math.min(0.45, 0.08 + overallBoost * 0.4);

      // Pulse particle size & opacity with beat
      material.size = 2.4 * energyPulse;
      material.opacity = Math.min(0.95, 0.5 + overallBoost * 0.45);

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || window.innerHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      particleTexture.dispose();
    };
  }, []);

  return (
    <div
      id="dynamic-particle-background-canvas"
      ref={mountRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-85"
      aria-hidden="true"
    />
  );
};
