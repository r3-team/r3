package tools

import (
	"context"

	"golang.org/x/oauth2/clientcredentials"
)

func GetOAuthToken(clientId string, clientSecret string, tenant string, tokenUrl string, scopes []string) (string, error) {
	conf := clientcredentials.Config{
		ClientID:     clientId,
		ClientSecret: clientSecret,
		TokenURL:     tokenUrl,
		Scopes:       scopes,
	}
	token, err := conf.Token(context.TODO())
	if err != nil {
		return "", err
	}
	return token.AccessToken, nil
}
