import { net, protocol } from 'electron'
import { extname } from 'path'
import { pathToFileURL } from 'url'
import { getLocalAssetByGlobalId } from './localAssetStore'

export const LOCAL_MEDIA_SCHEME = 'studio-local'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/mp4'
}

function localAssetIdFromUrl(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    const raw = url.hostname || url.pathname.replace(/^\/+/, '')
    return raw ? decodeURIComponent(raw) : null
  } catch {
    return null
  }
}

function notFound(): Response {
  return new Response('Local media not found', {
    status: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8'
    }
  })
}

export async function registerLocalMediaProtocol(): Promise<void> {
  await protocol.handle(LOCAL_MEDIA_SCHEME, async (request) => {
    const assetId = localAssetIdFromUrl(request.url)
    if (!assetId) return notFound()

    const asset = await getLocalAssetByGlobalId(assetId)
    if (!asset?.exists) return notFound()

    const upstream = await net.fetch(pathToFileURL(asset.absolutePath).toString(), {
      headers: request.headers
    })
    const headers = new Headers(upstream.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin')

    const contentType = CONTENT_TYPES[extname(asset.absolutePath).toLowerCase()]
    if (contentType && !headers.has('Content-Type')) {
      headers.set('Content-Type', contentType)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    })
  })
}
