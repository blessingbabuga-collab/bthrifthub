const fs = require('fs');
let code = fs.readFileSync('src/components/SiteHeader.tsx', 'utf8');

const queryHook = `
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('role').eq('id', user!.id).maybeSingle();
      return data;
    }
  });
  const isAdmin = profile?.role === 'admin';
`;

code = code.replace("  const { data: hasStore } = useQuery({", queryHook + "\n  const { data: hasStore } = useQuery({");

const adminLink = `
          {isMounted && isAdmin && (
            <Link to="/admin" className="hidden sm:flex px-3 py-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 hover:bg-indigo-100 rounded-md">Admin</Link>
          )}
`;

code = code.replace("{isMounted && user && (\\n            <Link to=\\"/orders\\"", adminLink + "\\n          {isMounted && user && (\\n            <Link to=\\"/orders\\"");

fs.writeFileSync('src/components/SiteHeader.tsx', code);
