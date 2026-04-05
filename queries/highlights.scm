; Aski v0.12 — syntax highlighting queries

; Comments
(comment) @comment

; Keywords / builtins
"Main" @keyword
"StdOut" @keyword.builtin
"Self" @type.builtin
"True" @constant.builtin
"False" @constant.builtin

; Types (PascalCase)
(type_identifier) @type
(self_type) @type.builtin

; Trait names (camelCase in declarations)
(trait_decl name: (identifier) @function.method)
(trait_impl trait_name: (identifier) @function.method)

; Method names
(trait_method_sig name: (identifier) @function.method)
(impl_member name: (identifier) @function.method)

; Domain/struct names
(domain_decl name: (type_identifier) @type.definition)
(struct_decl name: (type_identifier) @type.definition)
(variant (type_identifier) @type)

; Constants
(const_ref) @constant
(const_decl "!" @punctuation.special)
(const_decl name: (_) @constant)

; Instance references
(instance_ref) @variable
(self_ref) @variable.builtin

; Borrow/mutable references
(borrow_ref) @variable
(mutable_borrow_ref) @variable

; Literals
(integer_literal) @number
(float_literal) @number.float
(string_literal) @string
(string_content) @string
(string_interpolation) @string.special

; Operators
["+" "-" "*" "/" "%" "==" "!=" "<" ">" "<=" ">=" "&&" "||"] @operator
["." "/" "?" "^" "#"] @operator

; Delimiters
["(" ")" "[" "]" "{" "}" "(|" "|)" "[|" "|]" "{|" "|}"] @punctuation.bracket
["|" ":" "~" "@" "&"] @punctuation.special

; Grammar rules
(grammar_rule "<" @punctuation.special)
(grammar_rule ">" @punctuation.special)
(grammar_nonterminal "<" @punctuation.special)
(grammar_nonterminal ">" @punctuation.special)
(grammar_nonterminal (_) @function)

; Stub
(stub) @comment.unused

; FFI
(ffi_block library: (type_identifier) @module)
(ffi_function name: (identifier) @function)
(ffi_function extern_name: (identifier) @function.builtin)

; Module header
(module_header name: (type_identifier) @module)
(import_entry module: (type_identifier) @module)

; Wildcard
(wildcard) @variable.builtin
