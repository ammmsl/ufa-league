'use client'

import Script from 'next/script'
import PublicNav from '../_components/PublicNav'

export default function GalleryPage() {
  return (
    <div className="page-shell">
      <PublicNav />
      <Script
        src="https://cdn.jsdelivr.net/npm/publicalbum@latest/embed-ui.min.js"
        strategy="lazyOnload"
      />
      <div className="page-container">
        <h1 className="page-heading">Gallery</h1>
        <p className="page-subheading">Season 1 match photos</p>

        <div className="rounded-xl overflow-hidden">
          <div
            className="pa-gallery-player-widget"
            style={{ width: '100%', height: '480px', display: 'none' }}
            data-link="https://photos.app.goo.gl/6vWZi1mup4mGY5fP8"
            data-title="UFA League S1 · Saturday, Jan 31 📸"
            data-description="Shared album · Tap to view!"
            data-delay="4"
          >
            <object data="https://lh3.googleusercontent.com/pw/AP1GczMB4rmydU3ZvDP4p5qVhq5Ieejg86lgafEodeEqxQDdFlJfbKSi0OmE5HcKVzOWw4EuGjyCP9bILKmnzlVjvoV7tMOAZSr5jbYEMQ-bfAFQ9rXeQ4Dn=w1920-h1080" />
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-3 text-center">
          Photos open in Google Photos ↗
        </p>
        <a
          href="https://photos.app.goo.gl/6vWZi1mup4mGY5fP8"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm link-accent mt-2"
        >
          Open album in Google Photos ↗
        </a>
      </div>
    </div>
  )
}
