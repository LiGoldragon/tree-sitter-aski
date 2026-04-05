; Aski v0.12 — local variable scoping

; Method bodies create scopes
(computed_body) @local.scope
(tail_body) @local.scope
(matching_body) @local.scope

; Bindings define local variables
(binding (instance_ref) @local.definition)

; Instance refs are references
(instance_ref) @local.reference
