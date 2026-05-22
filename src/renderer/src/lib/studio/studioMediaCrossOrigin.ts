/**
 * Studio 范围内统一的 <img> / <video> crossOrigin 值。
 *
 * 必须使用 "anonymous"：监视器预览 / 导出 / 缩略图等都会用 drawImage 把同一份
 * 媒体画到 canvas 上，一旦任一处加载时没带 crossOrigin，浏览器就会把该 URL 的
 * "无 CORS" 响应缓存下来，后续即便加上 crossOrigin 再次加载也会沿用旧的缓存，
 * 导致 canvas 被「污染」，toBlob / getImageData / 导出全部失败。
 *
 * 同时，服务端必须返回 Access-Control-Allow-Origin。
 */
/**
 * Studio 范围内所有 <img> / <video> 元素统一使用的 crossOrigin 值。
 *
 * 背景：StudioPreviewPlayer 的画布会用 drawImage 把 <img>/<video> 绘制到 canvas，
 * 然后通过 toBlob/getImageData 导出。这要求图片/视频请求必须带 CORS：
 *   1) 元素本身设置 crossOrigin="anonymous"
 *   2) 服务端响应带 Access-Control-Allow-Origin
 * 否则 canvas 会被「污染」(tainted)，toBlob / getImageData / 导出全部失败。
 *
 * 更关键的是：同一个 URL 如果先被一个「不带 crossOrigin」的 <img>（例如缩略图、
 * 关键帧面板、素材库等）加载并缓存，浏览器会缓存一份「无 CORS 头」的响应；
 * 之后画布上的 <img crossOrigin="anonymous"> 命中缓存时拿不到 CORS 头，
 * 同样会导致 canvas 被污染。
 *
 * 因此 Studio 域内所有可能与同一 URL 产生交叠的 <img>/<video> 元素都必须使用
 * 同一份 crossOrigin 配置 —— 直接引用此常量即可，避免散落字符串。
 */

export const STUDIO_MEDIA_CROSS_ORIGIN = "anonymous" as const;
