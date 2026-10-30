FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home condo && mkdir /data && chown condo:condo /data
COPY --chown=condo:condo . .
USER condo
ENV DATABASE_PATH=/data/condo.sqlite
EXPOSE 8000
CMD ["python", "-m", "gunicorn", "app:create_app()", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4"]
