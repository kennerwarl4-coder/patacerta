# PataCerta · Funil de Quiz e Vendas

Funil de alta conversão para o programa de adiestramiento canino personalizado, 100% em conformidade com as diretrizes de aprovação de contas de seller (Mundpay, Hotmart, etc.).

## 🚀 Estrutura do Projeto

- `index.html` — Quiz interativo inteligente + Página de vendas (TSL) personalizada com garantia de 7 dias e rodapé institucional com identificação do vendedor.
- `soporte.html` — Centro de Ajuda e Suporte ao Comprador (canais oficiais, SLA de atendimento, fluxo de reembolso e acesso).
- `reembolso.html` — Política de Reembolso e Garantia incondicional de 7 dias com instruções e prazos de estorno.
- `privacidad.html` — Política de Privacidade em conformidade com a LGPD/RGPD (dados coletados, finalidades, DPO).
- `terminos.html` — Termos e Condições de Uso (licença de uso, entrega digital imediata, propriedade intelectual e avisos legais).
- `assets/` — Recursos visuais organizados por contexto:
  - `assets/brand/` — Favicons, ícones da marca e imagens OpenGraph para redes sociais.
  - `assets/quiz/` — Imagens do quiz separadas por categoria (`comportamento/`, `idade/`, `porte/`, `energia/`, `moradia/`, `correcao/`, `tempo/`, `objetos/`).
  - `assets/sales/` — Imagens editoriais, mockup do produto, selo de garantia e logos de pagamento da página de vendas.
- `vercel.json` — Configurações de rotas limpas e cache para deploy na Vercel.

## ⚙️ Configurações Principais

No arquivo `index.html` (dentro da tag `<script>`), preencha os parâmetros:

```javascript
const CONFIG = {
  CHECKOUT_BASICO:  "https://pay.hotmart.com/XXXX?off=basico",
  CHECKOUT_PREMIUM: "https://pay.hotmart.com/XXXX?off=premium",
  PIXEL_ID:         "SEU_PIXEL_ID", // Meta Pixel
  MONEDA:           "COP",

  EMPRESA: {
    razaoSocial: "SUA RAZAO SOCIAL LTDA",
    cnpj: "00.000.000/0001-00",
    endereco: "Seu Endereço Completo, Cidade/UF - CEP",
    email: "suporte@seudominio.com",
  },
};
```

## 🌐 Deploy na Vercel

1. Suba este repositório para o seu **GitHub**.
2. Acesse [vercel.com](https://vercel.com) e clique em **"Add New Project"**.
3. Importe este repositório.
4. O framework detectará automaticamente como projeto estático. Clique em **Deploy**.
