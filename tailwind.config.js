/** 新中式国风色彩。Tailwind v4 同时在 src/index.css 的 @theme 中注入同名颜色。 */
export default {
  theme: {
    extend: {
      colors: {
        paper: '#F8F4EC',
        ink: '#2C2C2C',
        peach: '#F4D0D7',
        mountain: '#B2CDD7',
        gold: '#C9B08A',
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Songti SC"', 'serif'],
        kai: ['"LXGW WenKai"', '"Noto Serif SC"', 'serif'],
        sans: ['system-ui', '"PingFang SC"', '"Microsoft YaHei UI"', 'sans-serif'],
      },
    },
  },
}
