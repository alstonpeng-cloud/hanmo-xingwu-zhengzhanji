# 英雄立绘分包素材

目录内所有图片会由 tools/build-wx.mjs 自动打进 pkg_heroes 分包（进入游戏后下载）。
建议：12 位英雄写实厚涂立绘 + 12 张招募低模小人，PNG/WebP 原图即可，不做有损压缩。
逻辑路径写法：assets/heroes/<文件名>，运行时用 resolveAsset() 取真实路径。
