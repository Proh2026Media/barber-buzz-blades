# Barba & Bola

Crie um app para barbearias onde ele tem integrado notificacoes e resultado do mundo esportivo nacional e internacional

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a16f48c-1555-4bcb-8412-4c3c9c2f5589).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

### Demonstração para o administrador global

Em `/platform`, ligue **Modo demonstração** e clique em **Abrir demonstração**.
A rota `/demo` permite alternar entre **Visão do cliente** e **Visão da barbearia**,
simular reservas, confirmar/concluir atendimentos e experimentar serviços e profissionais.
As duas visões compartilham os dados fictícios durante a prévia; concluir um atendimento
do cliente demonstrativo concede 50 pontos uma única vez.

O controle é exclusivo de `platform_admin` e fica salvo por usuário nesta aba do navegador.
Use o interruptor na demonstração ou no painel global para desligá-la. Cada abertura da
prévia começa com os exemplos iniciais, incluindo 250 pontos e relógio simulado às 09:00.
Todas as operações da demonstração ficam em memória, sem ler ou gravar dados operacionais
do Supabase. O login e a verificação de permissões continuam sendo reais.

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
