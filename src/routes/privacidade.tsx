import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/features/legal/LegalPageShell";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Barba & Cabelo" },
      {
        name: "description",
        content:
          "Como o Barba & Cabelo trata dados pessoais, inclusive informações obtidas via APIs do Google.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <LegalPageShell title="Política de Privacidade" updatedAt="24 de setembro de 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">1. Quem é responsável</h2>
        <p>
          O aplicativo <strong>Barba &amp; Cabelo</strong> (disponível em{" "}
          <a
            href="https://beauty.contheiner.digital"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            beauty.contheiner.digital
          </a>
          ) é operado por:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Razão social: <strong>{PLATFORM_OPERATOR.legalName}</strong>
          </li>
          <li>
            CNPJ: <strong>{PLATFORM_OPERATOR.cnpj}</strong>
          </li>
          <li>
            E-mail de contato sobre privacidade:{" "}
            <a
              href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`}
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {PLATFORM_OPERATOR.privacyEmail}
            </a>
          </li>
        </ul>
        <p>
          Use o e-mail acima para dúvidas, pedidos de acesso ou correção de dados. A exclusão
          permanente da conta pode ser feita pelo próprio usuário no app (Meu perfil), sem abrir
          chamado de suporte.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">2. Quais dados coletamos</h2>
        <p>No cadastro e no uso do serviço, podemos tratar:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Nome</strong> e dados de perfil da conta;
          </li>
          <li>
            <strong>E-mail</strong> (identificação e comunicação da conta);
          </li>
          <li>
            <strong>WhatsApp</strong> (quando informado), para confirmações, lembretes e códigos de
            verificação enviados pela barbearia ou pela plataforma;
          </li>
          <li>
            <strong>Agendamentos</strong> e informações relacionadas (serviço, profissional, data,
            horário, status e histórico necessários à operação da loja);
          </li>
          <li>
            Dados de uso técnicos mínimos (por exemplo, sessão de autenticação) para manter o
            serviço seguro e funcionando.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">3. Dados obtidos do Google</h2>
        <p>O Barba &amp; Cabelo pode integrar-se ao Google de duas formas distintas:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Login com Google:</strong> acessamos o perfil básico necessário para autenticar
            a conta (identidade e e-mail associados ao login).
          </li>
          <li>
            <strong>Google Agenda e Google Contatos:</strong> somente quando uma barbearia (ou
            membro autorizado) conecta a própria conta Google no painel. Nesse caso, usamos a Agenda
            para importar e criar eventos relacionados à operação, e os Contatos para salvar dados
            de clientes quando a loja solicita. Essa conexão é opcional e independente do e-mail de
            login no app.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">4. Como usamos (e o que não fazemos)</h2>
        <p>
          Os dados do Google são usados apenas para prestar o serviço solicitado pela barbearia
          (autenticação, sincronização de agenda e salvamento de contatos).{" "}
          <strong>
            Os dados do Google não são vendidos, não são usados para publicidade e não são
            repassados a terceiros
          </strong>
          , fora o estritamente necessário para o serviço funcionar (por exemplo, infraestrutura de
          hospedagem e autenticação).
        </p>
        <p>
          O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs
          do Google seguirão a Política de Dados do Usuário dos Serviços de API do Google, incluindo
          os requisitos de Uso Limitado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">5. Onde ficam e por quanto tempo</h2>
        <p>
          Os dados da aplicação ficam armazenados em servidores utilizados pela plataforma (banco de
          dados e autenticação do projeto), com acesso restrito aos controles de segurança do
          serviço. Mantemos as informações enquanto a conta ou a barbearia estiver ativa e enquanto
          forem necessárias para cumprir obrigações legais ou operar o agendamento.
        </p>
        <p>
          Tokens de conexão com Google Agenda/Contatos permanecem enquanto a integração estiver
          ativa; ao desconectar, deixamos de usar essa autorização.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          6. Exclusão da conta e desconexão do Google
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Excluir a conta permanentemente:</strong> em Meu perfil → Meus dados e
            privacidade, o titular pode apagar a própria conta sem suporte. Nome, e-mail, WhatsApp
            e demais dados pessoais são removidos. Registros de agenda e de frequência/atividade da
            barbearia podem permanecer apenas de forma anônima (sem vínculo com a pessoa), para
            estatísticas operacionais até a data da exclusão.
          </li>
          <li>
            Se você for <strong>dono ou sócio</strong> de uma loja, transfira a sociedade ou saia
            desse papel antes de excluir a conta.
          </li>
          <li>
            <strong>Desconectar Agenda/Contatos:</strong> no painel da loja, em Ajustes → Google
            Agenda e Contatos, use a opção de desconectar. Isso revoga o uso dessa autorização no
            app.
          </li>
          <li>
            <strong>Revogar no Google:</strong> também é possível remover o acesso em{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="font-semibold text-foreground underline-offset-2 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              myaccount.google.com/permissions
            </a>
            .
          </li>
          <li>
            Dúvidas:{" "}
            <a
              href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`}
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {PLATFORM_OPERATOR.privacyEmail}
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">7. Alterações</h2>
        <p>
          Podemos atualizar esta política para refletir mudanças no serviço ou na legislação. A data
          no topo da página indica a versão vigente. Em alterações relevantes, buscaremos informar
          pelos canais habituais do app.
        </p>
      </section>
    </LegalPageShell>
  );
}
