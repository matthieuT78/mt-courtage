export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/outil-gestion-locative",
      permanent: true,
    },
  };
}

export default function OutilsProprietaireRedirect() {
  return null;
}
