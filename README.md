SMS Orange Custom Activity pour Salesforce Marketing Cloud
Description
Cette application est une Custom Activity pour Salesforce Marketing Cloud (SFMC) Journey Builder qui permet aux marketeurs d'intégrer facilement l'envoi de SMS via l'API Orange Sénégal dans leurs parcours client automatisés.
L'application agit comme un pont entre Journey Builder et l'API SMS d'Orange, permettant l'envoi de messages SMS personnalisés aux contacts directement depuis les parcours SFMC, sans nécessiter de connaissances techniques approfondies de la part des utilisateurs.
Fonctionnalités

Envoi de SMS : Envoyez des messages texte aux numéros de téléphone mobile de vos contacts
Personnalisation des messages : Intégrez des champs de données dynamiques provenant de vos Data Extensions
Configuration simple : Interface utilisateur intuitive, accessible aux utilisateurs non techniques
Authentification sécurisée : Gestion automatique des tokens d'authentification Orange API côté serveur
Compatibilité avec les standards : Conforme aux exigences de SFMC pour les Custom Activities

Architecture technique
L'application est construite avec les technologies suivantes :

Frontend : HTML, CSS, JavaScript avec jQuery
Backend : Node.js avec Express
Intégration : Postmonger pour la communication avec Journey Builder
API externe : Orange SMS API (MEA)

L'architecture suit le modèle client-serveur :

Le client (interface utilisateur dans Journey Builder) permet de configurer les détails du SMS
Le serveur gère l'authentification et les appels à l'API Orange, ainsi que le traitement des données

Flux de fonctionnement

L'utilisateur configure l'activité SMS dans Journey Builder (sélectionne le numéro d'expéditeur, rédige le message, etc.)
Lorsqu'un contact entre dans cette étape du parcours, Journey Builder envoie les données du contact au serveur de l'application
Le serveur récupère automatiquement un token d'authentification auprès d'Orange API
Le serveur envoie le SMS au destinataire via l'API Orange, en remplaçant les champs de personnalisation par les données réelles du contact
Le statut de l'envoi est renvoyé à Journey Builder pour suivi

Avantages pour les utilisateurs

Intégration transparente : Fonctionne nativement dans l'interface familière de Journey Builder
Sécurité : Les informations d'identification sensibles sont gérées de manière sécurisée en backend
Flexibilité : Support des messages SMS transactionnels et promotionnels
Personnalisation : Intégration des données clients pour des messages personnalisés et pertinents
Simplicité : Interface intuitive qui ne nécessite pas de compétences techniques

Prérequis

Compte Salesforce Marketing Cloud avec accès à Journey Builder
Compte développeur Orange API avec accès à l'API SMS
Serveur pour héberger l'application (Heroku, Azure, AWS, etc.)
Client ID et Client Secret fournis par Orange pour l'authentification

Installation et configuration
L'installation comprend deux parties : déploiement du serveur et configuration dans SFMC.
Déploiement du serveur

Cloner ce dépôt
Installer les dépendances : npm install
Configurer les variables d'environnement (CLIENT_ID et CLIENT_SECRET)
Déployer l'application sur un serveur accessible depuis Internet
Vérifier que le serveur fonctionne en accédant à l'endpoint /status

Configuration dans SFMC

Créer un package installé dans SFMC (Setup > Apps > Installed Packages)
Ajouter un composant de type "Journey Builder Activity"
Configurer l'URL du serveur comme Endpoint URL
Accéder à Journey Builder et vérifier que l'activité est disponible

Sécurité
Cette application implémente plusieurs mesures de sécurité :

Les identifiants d'API sensibles sont stockés côté serveur, jamais exposés au client
L'authentification utilise le protocole OAuth 2.0
Les communications se font en HTTPS
Les données sensibles sont stockées dans des variables d'environnement, pas en dur dans le code

Limites et considérations

L'API Orange SMS limite le nombre de caractères à 160 par SMS
Des frais peuvent s'appliquer pour l'envoi de SMS via Orange
L'application ne gère pas le suivi de livraison des SMS (statut de réception)

Support et contribution
Pour toute question ou problème, veuillez ouvrir une issue sur ce dépôt. Les contributions sont les bienvenues via pull requests.
Licence
[Spécifier votre licence ici]
# clyx-sms
# clyx-sms
