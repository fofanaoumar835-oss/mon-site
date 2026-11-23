# Activer la boutique en ligne

Les produits, photos, avis et likes sont partagés via Supabase. Il faut configurer le projet une seule fois avant de publier le site.

## 1. Créer et configurer Supabase

1. Créez un projet sur [supabase.com](https://supabase.com/).
2. Dans **Project Settings → API**, copiez l’URL du projet et la clé **anon/public**.
3. Remplacez les deux valeurs dans [SupabaseConfig.js](./SupabaseConfig.js) :
   - `SUPABASE_URL` : l’URL du projet ;
   - `SUPABASE_ANON_KEY` : la clé publique `anon` ou `publishable`.
4. Dans **SQL Editor**, exécutez le contenu de [supabase-schema.sql](./supabase-schema.sql). Cela crée les tables, les règles d’accès et le stockage public des photos de produits.
5. Dans **Authentication → Providers**, activez les connexions anonymes. Elles permettent aux clients de publier un avis et de liker sans créer de compte.

N’utilisez jamais une clé `service_role` ou une clé secrète dans `SupabaseConfig.js`. Seule la clé publique `anon`/`publishable` doit être utilisée dans le navigateur.

## 2. Créer l’accès vendeur

1. Dans **Authentication → Users**, créez l’utilisateur vendeur avec son adresse e-mail et son mot de passe.
2. Copiez son identifiant **UUID**.
3. Dans **SQL Editor**, exécutez la requête ci-dessous en remplaçant l’identifiant :

```sql
insert into public.sellers (user_id)
values ('UUID_DU_VENDEUR');
```

Le vendeur pourra ensuite se connecter depuis le bouton **Espace vendeur** du site. Les autres visiteurs ne peuvent pas publier ni modifier les produits.

## 3. Lancer et publier le site

Servez le dossier avec un serveur web local ou publiez-le sur un hébergeur statique compatible avec HTTPS. N’ouvrez pas `Index.html` directement avec `file://` : les modules JavaScript et les connexions Supabase ont besoin d’une origine web.

Le catalogue accepte les photos JPG, PNG et WEBP de 5 Mo maximum. Les prix sont saisis en GNF. Les avis sont visibles dès leur publication ; le tableau de bord Supabase permet de les consulter.

Les likes sont limités à un par session visiteur sur chaque navigateur. Les avis et le catalogue sont stockés en ligne et partagés entre les visiteurs.
