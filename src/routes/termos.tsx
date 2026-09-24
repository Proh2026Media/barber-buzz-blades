import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/features/legal/LegalPageShell";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Barba & Cabelo" },
      {
        name: "description",
        content:
          "Termos de uso do aplicativo Barba & Cabelo para barbearias, profissionais e clientes.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <LegalPageShell title="Termos de Uso" updatedAt="24 de setembro de 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">1. Aceitação</h2>
        <p>
          Ao acessar ou usar o aplicativo <strong>Barba &amp; Cabelo</strong> (
          <a
            href="https://beauty.contheiner.digital"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            beauty.contheiner.digital
          </a>
          ), você concorda com estes Termos de Uso e com a{" "}
          <a href="/privacidade" className="font-semibold text-foreground underline-offset-2 hover:underline">
            Política de Privacidade
          </a>
          . Se não concordar, não utilize o serviço.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">2. O serviço</h2>
        <p>
          O Barba &amp; Cabelo é uma plataforma de agendamento, fidelidade e gestão para
          barbearias. Permite que lojas cadastrem serviços e equipe, que clientes reservem horários
          e que a operação acompanhe agenda e comunicações relacionadas ao atendimento.
        </p>
        <p>
          Integrações opcionais (por exemplo, WhatsApp da loja ou Google Agenda/Contatos) dependem
          de conexão e autorização feitas pelo responsável da barbearia.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">3. Contas e responsabilidades</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Você é responsável por manter a confidencialidade das credenciais e por atividades
            realizadas na sua conta.
          </li>
          <li>
            Donos e administradores da loja são responsáveis pelos dados que cadastram (equipe,
            serviços, clientes e comunicações) e pelo cumprimento das leis aplicáveis na relação com
            seus clientes.
          </li>
          <li>
            Informações fornecidas devem ser verdadeiras e atualizadas. Uso abusivo, fraude ou
            tentativa de acesso indevido podem resultar em suspensão ou encerramento da conta.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">4. Google e outros serviços de terceiros</h2>
        <p>
          Quando você usa login Google ou conecta Google Agenda/Contatos, também se aplicam os
          termos e políticas do Google. O tratamento dessas informações está descrito na nossa
          Política de Privacidade. Você pode desconectar a integração a qualquer momento nas
          configurações do app ou nas permissões da sua conta Google.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">5. Disponibilidade</h2>
        <p>
          Buscamos manter o serviço disponível e seguro, mas não garantimos funcionamento
          ininterrupto. Manutenções, falhas de rede ou de provedores externos podem afetar o acesso
          temporariamente.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">6. Limitação</h2>
        <p>
          Na máxima extensão permitida pela lei, o Barba &amp; Cabelo não se responsabiliza por
          danos indiretos, lucros cessantes ou prejuízos decorrentes do uso ou da impossibilidade de
          uso do serviço, nem por conteúdos ou decisões operacionais das barbearias usuárias.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">7. Contato e alterações</h2>
        <p>
          Dúvidas sobre estes termos:{" "}
          <a
            href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`}
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            {PLATFORM_OPERATOR.privacyEmail}
          </a>
          . Operador: <strong>{PLATFORM_OPERATOR.legalName}</strong>, CNPJ{" "}
          <strong>{PLATFORM_OPERATOR.cnpj}</strong>.
        </p>
        <p>
          Você pode excluir permanentemente a própria conta no app (Meu perfil), sem suporte. Dados
          pessoais são removidos; registros operacionais anônimos de agenda/frequência podem
          permanecer na barbearia.
        </p>
        <p>
          Podemos atualizar estes Termos periodicamente. A data no topo indica a versão vigente. O
          uso continuado após a publicação das alterações constitui aceitação da nova versão, quando
          permitido pela legislação aplicável.
        </p>
      </section>
    </LegalPageShell>
  );
}
