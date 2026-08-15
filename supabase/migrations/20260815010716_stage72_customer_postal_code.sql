-- Stage 7.2: el cliente ingresa el código postal y la dirección se conserva
-- aunque no exista una coordenada verificable para esa calle.

ALTER TABLE public.shipping_quotes
  DROP CONSTRAINT shipping_quotes_structured_address,
  ADD CONSTRAINT shipping_quotes_structured_address CHECK (
    (
      destination_province_id IS NULL
      AND destination_locality_id IS NULL
      AND destination_street IS NULL
      AND destination_number IS NULL
      AND destination_formatted_address IS NULL
      AND destination_lat IS NULL
      AND destination_lon IS NULL
    )
    OR (
      destination_province_id ~ '^[0-9]{2}$'
      AND destination_locality_id ~ '^[0-9]{8}$'
      AND char_length(destination_street) BETWEEN 1 AND 160
      AND char_length(destination_number) BETWEEN 1 AND 20
      AND char_length(destination_formatted_address) BETWEEN 1 AND 300
      AND (
        (destination_lat IS NULL AND destination_lon IS NULL)
        OR (
          destination_lat BETWEEN -55.2 AND -21.7
          AND destination_lon BETWEEN -73.7 AND -53.5
        )
      )
    )
  );

ALTER TABLE public.orders
  DROP CONSTRAINT orders_structured_shipping_address,
  ADD CONSTRAINT orders_structured_shipping_address CHECK (
    (
      shipping_destination_province_id IS NULL
      AND shipping_destination_locality_id IS NULL
      AND shipping_destination_street IS NULL
      AND shipping_destination_number IS NULL
      AND shipping_destination_formatted_address IS NULL
      AND shipping_destination_lat IS NULL
      AND shipping_destination_lon IS NULL
    )
    OR (
      shipping_destination_province_id ~ '^[0-9]{2}$'
      AND shipping_destination_locality_id ~ '^[0-9]{8}$'
      AND char_length(shipping_destination_street) BETWEEN 1 AND 160
      AND char_length(shipping_destination_number) BETWEEN 1 AND 20
      AND char_length(shipping_destination_formatted_address) BETWEEN 1 AND 300
      AND (
        (shipping_destination_lat IS NULL AND shipping_destination_lon IS NULL)
        OR (
          shipping_destination_lat BETWEEN -55.2 AND -21.7
          AND shipping_destination_lon BETWEEN -73.7 AND -53.5
        )
      )
    )
  );

COMMENT ON CONSTRAINT shipping_quotes_structured_address ON public.shipping_quotes IS
  'Stage 7.2: dirección ingresada por el cliente; coordenadas opcionales y siempre emparejadas.';

COMMENT ON CONSTRAINT orders_structured_shipping_address ON public.orders IS
  'Stage 7.2: dirección de despacho conservada aun cuando no haya coordenadas.';
