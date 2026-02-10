# Routing Architecture (GameHub)

## Goals
- Single routing tree
- Nested layouts using React Router v6
- `<Outlet />`-based rendering
- No duplicated page renders

## Visual Routing Diagram

```
BrowserRouter
└── App
    └── AppRoutes
        └── ResponsiveLayout
            ├── Navbar
            ├── Sidebar
            └── <Outlet />
                ├── / → Home
                ├── /login
                └── ProtectedLayout
                    ├── /lobby/:id
                    └── /games/:id
```

## Rules
- Layouts never render routes
- Routes decide pages
- Auth handled by RequireAuth only
