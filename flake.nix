{
  description = "tree-sitter-aski — Aski v0.12 grammar for tree-sitter";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      # Build the WASM parser using emscripten from nixpkgs
      tree-sitter-aski-wasm = pkgs.stdenv.mkDerivation {
        pname = "tree-sitter-aski-wasm";
        version = "0.12.0";
        src = ./.;

        nativeBuildInputs = with pkgs; [
          tree-sitter
          emscripten
          nodejs
        ];

        buildPhase = ''
          export HOME=$TMPDIR
          export EM_CACHE=$TMPDIR/.emscripten_cache
          mkdir -p $EM_CACHE

          # Generate parser if needed
          tree-sitter generate || true

          # Build WASM
          tree-sitter build --wasm --output tree-sitter-aski.wasm
        '';

        installPhase = ''
          mkdir -p $out
          cp tree-sitter-aski.wasm $out/
          cp -r queries $out/
          cp grammar.js $out/
          cp tree-sitter.json $out/
          cp -r src $out/
        '';
      };

    in {
      packages.${system} = {
        default = tree-sitter-aski-wasm;
        wasm = tree-sitter-aski-wasm;
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          tree-sitter
          emscripten
          nodejs
        ];
      };
    };
}
