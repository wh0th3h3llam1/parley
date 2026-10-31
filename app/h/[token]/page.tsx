import HallWorkspace from "../../hall-workspace";
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <HallWorkspace key={token} token={token} />;
}
