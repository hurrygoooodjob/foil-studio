# 离线视频导出组件

此目录包含两个未经修改的发布构建。浏览器按需从 Demo 同目录加载，视频编码与封装均在本机完成。

- mp4-muxer 5.2.2 将 WebCodecs 的 AVC 数据封装为 MP4。MIT 许可和作者声明随附于 mp4-muxer-LICENSE.txt。[发布源码](https://github.com/Vanilagy/mp4-muxer/tree/48cfeb866cae3e0e17d8feb569a4deadb3f0c9d1)
- h264-mp4-encoder 1.0.12 提供内嵌 WebAssembly 的 H.264 软件编码器。MIT 许可和作者声明随附于 h264-mp4-encoder-LICENSE.txt。[发布源码与构建方法](https://github.com/TrevorSundberg/h264-mp4-encoder/tree/6d177fd043157606224cef4702e134dd31f6adfa)
- 上述 WebAssembly 构建包含 minih264（public domain）和 libmp4v2（MPL 1.1）。libmp4v2 的许可全文随附于 libmp4v2-COPYING.txt。这些组件的源代码可从以下版本获取。[minih264 源码](https://github.com/TrevorSundberg/minih264/tree/25f4410) · [libmp4v2 源码](https://github.com/TrevorSundberg/libmp4v2/tree/d49b446)
