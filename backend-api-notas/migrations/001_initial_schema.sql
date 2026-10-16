CREATE TABLE IF NOT EXISTS matricula (
    matricula_id UUID PRIMARY KEY,
    estudante_id VARCHAR(100) NOT NULL,
    oferta_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    sincronizada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_matricula_estudante_oferta
        UNIQUE (estudante_id, oferta_id)
);

CREATE INDEX IF NOT EXISTS ix_matricula_oferta_status
    ON matricula (oferta_id, status, matricula_id);

CREATE TABLE IF NOT EXISTS professor_teste (
    professor_id VARCHAR(100) PRIMARY KEY,
    senha_hash VARCHAR(250) NOT NULL,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_professor_teste_id_nao_vazio
        CHECK (length(trim(professor_id)) > 0)
);

CREATE TABLE IF NOT EXISTS nota (
    nota_id UUID PRIMARY KEY,
    matricula_id UUID NOT NULL REFERENCES matricula (matricula_id),
    posicao SMALLINT NOT NULL,
    valor NUMERIC NOT NULL,
    observacao VARCHAR(500),
    criado_por VARCHAR(100) NOT NULL,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_por VARCHAR(100),
    atualizada_em TIMESTAMPTZ,
    excluido_por VARCHAR(100),
    excluida_em TIMESTAMPTZ,
    CONSTRAINT ck_nota_posicao CHECK (posicao IN (1, 2)),
    CONSTRAINT ck_nota_valor_intervalo CHECK (valor >= 0 AND valor <= 10),
    CONSTRAINT ck_nota_uma_casa_decimal CHECK (valor = trunc(valor, 1)),
    CONSTRAINT ck_nota_atualizacao_coerente
        CHECK ((atualizada_em IS NULL) = (atualizado_por IS NULL)),
    CONSTRAINT ck_nota_exclusao_coerente
        CHECK ((excluida_em IS NULL) = (excluido_por IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nota_ativa_matricula_posicao
    ON nota (matricula_id, posicao)
    WHERE excluida_em IS NULL;

CREATE INDEX IF NOT EXISTS ix_nota_matricula_ativas
    ON nota (matricula_id, posicao)
    WHERE excluida_em IS NULL;

CREATE INDEX IF NOT EXISTS ix_nota_matricula_paginacao
    ON nota (matricula_id, nota_id)
    WHERE excluida_em IS NULL;

CREATE TABLE IF NOT EXISTS auditoria (
    auditoria_id UUID PRIMARY KEY,
    nota_id UUID REFERENCES nota (nota_id),
    tipo_evento VARCHAR(30) NOT NULL,
    professor_id VARCHAR(100),
    metodo_http VARCHAR(10),
    caminho VARCHAR(500),
    status_http SMALLINT,
    request_id VARCHAR(100),
    estado_anterior JSONB,
    estado_novo JSONB,
    ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_auditoria_tipo_evento CHECK (
        tipo_evento IN ('ACESSO', 'CRIACAO', 'ATUALIZACAO', 'EXCLUSAO_LOGICA')
    ),
    CONSTRAINT ck_auditoria_status_http
        CHECK (status_http IS NULL OR status_http BETWEEN 100 AND 599)
);

CREATE INDEX IF NOT EXISTS ix_auditoria_ocorrido_em
    ON auditoria (ocorrido_em DESC);

CREATE INDEX IF NOT EXISTS ix_auditoria_nota_ocorrido_em
    ON auditoria (nota_id, ocorrido_em DESC)
    WHERE nota_id IS NOT NULL;

CREATE OR REPLACE FUNCTION impedir_alteracao_auditoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Registros de auditoria sao imutaveis';
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_imutavel ON auditoria;
CREATE TRIGGER trg_auditoria_imutavel
    BEFORE UPDATE OR DELETE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_auditoria();
