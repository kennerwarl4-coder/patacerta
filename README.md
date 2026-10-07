# PataCerta · Funil de Quiz e Vendas

Funil de alta conversão para o programa de adiestramiento canino personalizado, otimizado para o mercado colombiano.

## 🚀 Estrutura do Projeto

- `index.html` — Quiz interativo inteligente + Página de vendas (TSL) personalizada.
- `privacidad.html` — Política de Privacidade e Termos de Uso.
- `soporte.html` — Centro de Ajuda e Suporte ao Comprador.
- `assets/` — Imagens, ícones e assets de alta resolução.
- `vercel.json` — Configurações de rotas limpas e cache para deploy na Vercel.

## ⚙️ Configurações Principais

No arquivo `index.html` (dentro da tag `<script>`), preencha os parâmetros:

```javascript
const CONFIG = {
  CHECKOUT_BASICO:  "https://pay.hotmart.com/XXXX?off=basico",
  CHECKOUT_PREMIUM: "https://pay.hotmart.com/XXXX?off=premium",
  PIXEL_ID:         "SEU_PIXEL_ID", // Meta Pixel
  MONEDA:           "COP",
};
```

## 🌐 Deploy na Vercel

1. Suba este repositório para o seu **GitHub**.
2. Acesse [vercel.com](https://vercel.com) e clique em **"Add New Project"**.
3. Importe este repositório.
4. O framework detectará automaticamente como projeto estático. Clique em **Deploy**.
